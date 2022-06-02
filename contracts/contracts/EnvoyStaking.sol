//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title A staking contract for Cooker tokens
 * @author Kasper De Blieck (kasper@cooker.art)
 * This contract allows Cooker token owners to stake their funds.
 * Staking funds will reward a periodic compounded interest.
 */
contract CookerStaking is Ownable {
    
    using SafeMath for uint;

    /**
    Emits when a config field is updated
    @param field_ of the field
    @param value_ new value of the field
     */
    event ConfigUpdate(string field_, uint value_);
    /**
    Emits when new address stakes
    @param stakeholder_ address of the stakeholder
    @param stake_ new amount of staked tokens
     */
    event Staking(address indexed stakeholder_, uint stake_);
    /**
    Emits when stakeholder claims rewards
    @param stakeholder_ address of the stakeholder
    @param reward_ reward claimed
    @param lockedReward_ amount of additional reward that is locked
    @param numberOfPeriods_ number of periods rewarded
     */
    event Rewarding(address indexed stakeholder_, uint reward_, uint lockedReward_, uint numberOfPeriods_);
    /**
     Emits when a stakeholder requested a withdrawal
     @param stakeholder_ address of the stakeholder
     @param amount_ amount of tokens withdrawn from the contract 
     @param releaseDate_ timestamp when cooldown is over for the user  
     */
    event InitiateWithdraw(address stakeholder_, uint amount_, uint releaseDate_);
    /**
     Emits when a stakeholder finalizes a withdrawal
     @param stakeholder_ address of the stakeholder
     @param amount_ amount of tokens sent to the stakeholder
     @param fee_ fee paid for early withdrawal
     */
    event Withdraw(address stakeholder_, uint amount_, uint fee_);
    /**
     Emits when a new staker enters the contract by staking or existing stakeholder leaves by withdrawing
     @param stakeholder_ address of the stakeholder
     @param active_ yes if the staker becomes active, false if inactive
     */
    event Active(address stakeholder_, bool active_);

    struct Withdrawal{
        uint releaseDate; // Date on which the stakeholder is able to withdraw the staked funds
        uint releaseAmount; // Amount to be released at the release date
    }

    /** @return Stakeholder Struct containing the state of each stakeholder */
    struct StakeHolder {
        uint stakingBalance; // Staking balance of the stakeholder
        uint weight; // The weight of the staker
        uint startDate; // The date the staker joined
        uint lastClaimed; // The date the stakeholder claimed the last rewards
        uint newStake; // Will be used to update the stake of the user in the next period
        uint lockedRewards; // Extra reward claimable after additional time has passed
        Withdrawal[] withdrawals; // Amount to be released at the release date
    }

    function getWithdrawalLength(address stakeholderAddress) public view returns(uint length){
        return stakeholders[stakeholderAddress].withdrawals.length;
    }

    function getWithdrawal(uint index, address stakeholderAddress) public view returns(uint releaseDate, uint releaseAmount){
        return (stakeholders[stakeholderAddress].withdrawals[index].releaseDate,
                stakeholders[stakeholderAddress].withdrawals[index].releaseAmount);
    }

    /** @return RewardPeriod Struct containing the state of each reward period.*/
    struct RewardPeriod {
        uint rewardPerPeriod; // amount to distribute over stakeholders
        uint extraRewardMultiplier; // Used to calculate the extra reward on each reward (will be divided by decimalPrecision)
        uint maxWeight; // Highest weight observed in the period
        mapping (uint => uint) _totalStakingBalance; // Mapping weight to stake amount of tokens staked
    }

    // Keeps track of user information by mapping the stakeholder address to his state */
    mapping(address => StakeHolder) public stakeholders;

    // Keeps track of the different reward intervals, sequentially */
    mapping (uint => RewardPeriod) public rewardPeriods;

    // How many reward periods are handled */
    uint public latestRewardPeriod; // How many reward periods are handled
    mapping (uint => uint) _totalNewStake; // Tokens staked in this period to be added in the next one.
    mapping (uint => uint) public _totalLockedRewards; // Total amount of locked rewards
    mapping (uint => uint) public weightCounts; // counts of stakers per weight

    // Address used to verify users updating weight
    address public signatureAddress;

    IERC20 public stakingToken;

    uint public startDate; // Used to calculate how many periods have passed
    uint public maxNumberOfPeriods; // Used to cap the end date in the reward calculation
    uint public rewardPeriodDuration; // Length in between reward distribution
    uint public periodsForExtraReward; // Interval after which stakers get an extra reward
    uint public cooldown; // Length between withdrawal request and withdrawal without fee is possible
    uint public earlyWithdrawalFee; // Fee penalising early withdrawal, percentage times decimalPrecision
    uint public decimalPrecision = 10**6;

    /**
     Sets a number of initial state variables
     */
    constructor(
                uint maxNumberOfPeriods_, // Used to cap the end date in the reward calculation
                uint rewardPeriodDuration_, // Length in between reward distribution
                uint periodsForExtraReward_, // Interval after which stakers get an extra reward
                uint extraRewardMultiplier_,
                uint cooldown_,
                uint earlyWithdrawalFee_,
                address signatureAddress_,
                address stakingTokenAddress) {
        maxNumberOfPeriods = maxNumberOfPeriods_;
        rewardPeriodDuration = rewardPeriodDuration_;
        periodsForExtraReward = periodsForExtraReward_;
        cooldown = cooldown_;
        earlyWithdrawalFee = earlyWithdrawalFee_;

        signatureAddress = signatureAddress_;
        stakingToken = IERC20(stakingTokenAddress);

        startDate = block.timestamp;            
        
        // Initialise the first reward period in the sequence
        rewardPeriods[0].extraRewardMultiplier = extraRewardMultiplier_;

        //new CookerStakingToken(address(this));
    }

    /**
     * Calculates the staking balance for a certain period.
     * Also weighted (or multiple weighted) balances can be returned
     * @param period The period for which to call the balance
     * @param weightExponent How many times does the stake need to be multiplied with the weight?
     * @return totalStaking the total amount staked for the parameters.
     */
    function totalStakingBalance(uint period, uint weightExponent) public view returns (uint totalStaking){
        for(uint i = 0; i <= rewardPeriods[period].maxWeight; i++){
            totalStaking += rewardPeriods[period]._totalStakingBalance[i] * (i+1) ** weightExponent;
        }
    }

    /**
     * Calculates the new staking balance accumulated in the current period.
     * Also weighted (or multiple weighted) balances can be returned
     * @param weightExponent How many times does the stake need to be multiplied with the weight?
     * @return totalNew the total new amount staked to be included next period.
     */
    function totalNewStake(uint weightExponent) public view returns (uint totalNew){
        for(uint i = 0; i <= rewardPeriods[latestRewardPeriod].maxWeight; i++){
            totalNew += _totalNewStake[i] * (i+1) ** weightExponent;        
        }
    }

    /**
     * Calculates the new total locked rewards accumulated since latest unlock date.
     * Also weighted (or multiple weighted) balances can be returned
     * @param weightExponent How many times does the stake need to be multiplied with the weight?
     * @return totalLocked the total new amount staked to be included next period.
     */
    function totalLockedRewards(uint weightExponent) public view returns (uint totalLocked){
        for(uint i = 0; i <= rewardPeriods[latestRewardPeriod].maxWeight; i++){
            totalLocked += _totalLockedRewards[i] * (i+1) ** weightExponent;        
        }
    }

    /**
     * Function to call when a new reward period is entered.
     * The function will increment the maxRewardPeriod field,
     * making the state of previous period immutable.
     * The state will use the state of the last period as start for the current period.
     * The total staking balance is updated with:
     * - stake added in previous period
     * - rewards earned in previous period
     * - locked tokens, if they are unlocked.
     * @param endPeriod the last period the function should handle.
     *  cannot exceed the current period.
     */
    function handleNewPeriod(uint endPeriod) public {
        // Don't update passed current period
        if(currentPeriod() < endPeriod ){
            endPeriod = currentPeriod();
        }
        // Close previous periods if in the past and create a new one
        while(latestRewardPeriod < endPeriod){
            // Update the rewards for the period to close - exclude 
            uint twsb = totalStakingBalance(latestRewardPeriod, 1);
            rewardPeriods[latestRewardPeriod].rewardPerPeriod = calculateRewardPerPeriod();

            // Initiate new period
            latestRewardPeriod++;
            rewardPeriods[latestRewardPeriod].extraRewardMultiplier = rewardPeriods[latestRewardPeriod-1].extraRewardMultiplier;
            rewardPeriods[latestRewardPeriod].maxWeight = rewardPeriods[latestRewardPeriod-1].maxWeight;
            rewardPeriods[latestRewardPeriod].rewardPerPeriod = rewardPeriods[latestRewardPeriod-1].rewardPerPeriod;

            // Calculate total new staking positions per weight
            for(uint i = 0; i<=rewardPeriods[latestRewardPeriod-1].maxWeight;i++){
                rewardPeriods[latestRewardPeriod]._totalStakingBalance[i] = rewardPeriods[latestRewardPeriod-1]._totalStakingBalance[i] + _totalNewStake[i];
                _totalNewStake[i] = 0;
                uint newReward = 0;
                if(twsb > 0 && rewardPeriods[latestRewardPeriod-1]._totalStakingBalance[i] > 0){
                    newReward = (rewardPeriods[latestRewardPeriod-1].rewardPerPeriod * (i+1) + twsb)
                        * rewardPeriods[latestRewardPeriod-1]._totalStakingBalance[i] / twsb
                        - rewardPeriods[latestRewardPeriod-1]._totalStakingBalance[i];
                    rewardPeriods[latestRewardPeriod]._totalStakingBalance[i] += newReward;

                }
                if(latestRewardPeriod % periodsForExtraReward == 1){
                    rewardPeriods[latestRewardPeriod]._totalStakingBalance[i] += _totalLockedRewards[i]
                            + newReward * rewardPeriods[latestRewardPeriod-1].extraRewardMultiplier / (decimalPrecision);
                    _totalLockedRewards[i] = 0;
                } else {
                    _totalLockedRewards[i] += newReward * rewardPeriods[latestRewardPeriod-1].extraRewardMultiplier / (decimalPrecision);
                }
            }
        }
    }

    /** Calculate reward for previous period when balance is known
    If no stakingbalance is present, rewardPerPeriod will stay 0
    @return rewardPerPeriod the reward per period based on current token balans
    */
    function calculateRewardPerPeriod() public view returns(uint rewardPerPeriod){
        uint totalStaked = totalStakingBalance(latestRewardPeriod, 0)
                    + totalNewStake(0)
                    + totalLockedRewards(0);
            if((totalStakingBalance(latestRewardPeriod, 1) > 0)
                && stakingToken.balanceOf(address(this)) > totalStaked){
                rewardPerPeriod = (stakingToken.balanceOf(address(this)) - totalStaked)
                    * decimalPrecision
                    / ((maxNumberOfPeriods + 1 - latestRewardPeriod) 
                        * (rewardPeriods[latestRewardPeriod].extraRewardMultiplier + decimalPrecision));
            } else {
                rewardPerPeriod = 0;
            }
    }

    /**
     * Increase the stake of the sender by a value.
     * @param weight_ The new weight.
     * @param signature A signature proving the sender
     *  is allowed to update his weight.
     */
    function increaseWeight(uint weight_, bytes memory signature) public{
        // Close previous period if in the past and create a new one, else update the latest one.
        handleNewPeriod(currentPeriod());
    
        address sender = _msgSender();

        // Verify the stakeholder was allowed to update stake
        require(signatureAddress == _recoverSigner(sender, weight_, signature),
            "Invalid sig");

        StakeHolder storage stakeholder = stakeholders[sender];
        require(weight_ > stakeholder.weight, "No weight increase");


        // Some updates are only necessary if the staker is active
        if(activeStakeholder(sender)){
            // Claim previous rewards with old weight
            handleRewards(currentPeriod(), false, sender);

            // Update the total weighted amount of the current period.
            rewardPeriods[latestRewardPeriod]._totalStakingBalance[stakeholder.weight] -= stakeholder.stakingBalance;
            rewardPeriods[latestRewardPeriod]._totalStakingBalance[weight_] += stakeholder.stakingBalance;
            
            // Adjust total new stake
            _totalNewStake[stakeholder.weight] -= stakeholder.newStake;
            _totalNewStake[weight_] += stakeholder.newStake;

            // Move locked rewards so they will be added to the correct total stake
            _totalLockedRewards[stakeholder.weight] -= stakeholder.lockedRewards;
            _totalLockedRewards[weight_] += stakeholder.lockedRewards;
        
            weightCounts[stakeholder.weight]--;
            weightCounts[weight_]++;

            // Keep track of highest weight
            if(weight_ > rewardPeriods[latestRewardPeriod].maxWeight){
                rewardPeriods[latestRewardPeriod].maxWeight = weight_;
            }

        }

        // Finally, set the new weight
        stakeholder.weight = weight_;
    }

    /**
     * Update the stake of a list of stakeholders as owner.
     * @param stakeholders_ The stakeholders
     * @param weights_ The new weights.
     *  is allowed to update his weight.
     */
    function updateWeightBatch(address[] memory stakeholders_, uint[] memory weights_) public onlyOwner{

        require(stakeholders_.length == weights_.length, "Length mismatch");

        // Close previous period if in the past and create a new one, else update the latest one.
        handleNewPeriod(currentPeriod());
        claimRewardsAsOwner(stakeholders_);

        for(uint i = 0; i < stakeholders_.length; i++){

            StakeHolder storage stakeholder = stakeholders[stakeholders_[i]];
            if(weights_[i] == stakeholder.weight){continue;}


            // Some updates are only necessary if the staker is active
            if(activeStakeholder(stakeholders_[i])){

                // Update the total weighted amount of the current period.
                rewardPeriods[latestRewardPeriod]._totalStakingBalance[stakeholder.weight] -= stakeholder.stakingBalance;
                rewardPeriods[latestRewardPeriod]._totalStakingBalance[weights_[i]] += stakeholder.stakingBalance;
            
                // Adjust total new stake
                _totalNewStake[stakeholder.weight] -= stakeholder.newStake;
                _totalNewStake[weights_[i]] += stakeholder.newStake;
                
                // Move locked rewards so they will be added to the correct total stake
                _totalLockedRewards[stakeholder.weight] -= stakeholder.lockedRewards;
                _totalLockedRewards[weights_[i]] += stakeholder.lockedRewards;
                
                weightCounts[stakeholder.weight]--;
                weightCounts[weights_[i]]++;

                // Keep track of highest weight
                if(weights_[i] > rewardPeriods[latestRewardPeriod].maxWeight){
                    rewardPeriods[latestRewardPeriod].maxWeight = weights_[i];
                }
            
            }

            // Finally, set the new weight
            stakeholder.weight = weights_[i];

        }

        // Check if maxWeight decreased
        handleDecreasingMaxWeight();
    }

    /**
     * Increase the stake of the sender by a value.
     * @param amount The amount to stake
     */
    function stake(uint amount) public {
        // Close previous period if in the past and create a new one, else update the latest one.
        handleNewPeriod(currentPeriod());
        address sender = _msgSender();

        require(amount > 0, "Amount not positive");
        require(stakingToken.allowance(sender, address(this)) >= amount,
             "Token transfer not approved");

        // Transfer the tokens for staking
        stakingToken.transferFrom(sender, address(this), amount);

        // Update the stakeholders state
        StakeHolder storage stakeholder = stakeholders[sender];

        // Handle new staker
        if(activeStakeholder(sender) == false){
            if(stakeholder.weight > rewardPeriods[latestRewardPeriod].maxWeight){
                rewardPeriods[latestRewardPeriod].maxWeight = stakeholder.weight;
            }
            weightCounts[stakeholder.weight]++;
            stakeholder.startDate = block.timestamp;
            stakeholder.lastClaimed = currentPeriod();
            emit Active(sender, true);
        }

        // Claim previous rewards with old staked value
        handleRewards(currentPeriod(), false, sender);

        // The current period will calculate rewards with the old stake.
        // Afterwards, newStake will be added to stake and calculation uses updated balance
        stakeholder.newStake += amount;

        // Update the totals
        _totalNewStake[stakeholder.weight] += amount;
        
        emit Staking(sender, amount);
    }

    /**
     Request to withdrawal funds from the contract.
     The funds will not be regarded as stake anymore: no rewards can be earned anymore.
     The funds are not withdrawn directly, they can be claimed with `withdrawFunds`
     after the cooldown period has passed.
     @dev the request will set the releaseDate for the stakeholder to `cooldown` time in the future,
      and the releaseAmount to the amount requested for withdrawal.
     @param amount The amount to withdraw, capped by the total stake + owed rewards.
     @param instant If set to true, the `withdrawFunds` function will be called at the end of the request.
      No second transaction is needed, but the full `earlyWithdrawalFee` needs to be paid.
     @param claimRewardsFirst a boolean flag: should be set to true if you want to claim your rewards.
      If set to false, all owed rewards will be dropped. Build in for safety, funds can be withdrawn
      even when the reward calculations encounters a breaking bug.
     */
    function requestWithdrawal(uint amount, bool instant, bool claimRewardsFirst) public {
        address sender = _msgSender();
        StakeHolder storage stakeholder = stakeholders[sender];
        
        // If there is no cooldown, there is no need to have 2 separate function calls
        if(cooldown == 0){
            instant = true;
        }

        // Claim rewards with current stake
        // Can be skipped as failsafe in case claiming rewards fails,
        // but REWARDS ARE LOST.
        if (claimRewardsFirst){
            handleNewPeriod(currentPeriod());
            handleRewards(currentPeriod(), false, sender);
        } else {
            stakeholder.lastClaimed = currentPeriod();
        }
        
        require(stakeholder.stakingBalance >= 0 || stakeholder.newStake >= 0, "Nothing was staked");
        
        // First, withdraw newstake.
        // If the amount exceeds this value, withdraw also from the staking balance.
        // If the amount exceeds both balance, cap at the sum of the values
        if(amount > stakeholder.newStake){
            if((amount - stakeholder.newStake) > stakeholder.stakingBalance){
                amount = stakeholder.stakingBalance + stakeholder.newStake;
                rewardPeriods[latestRewardPeriod]._totalStakingBalance[stakeholder.weight] -= stakeholder.stakingBalance;
                stakeholder.stakingBalance = 0;
            } else {
                rewardPeriods[latestRewardPeriod]._totalStakingBalance[stakeholder.weight] -= (amount - stakeholder.newStake);
                stakeholder.stakingBalance -= (amount - stakeholder.newStake);
            }
            _totalNewStake[stakeholder.weight] -= stakeholder.newStake;
            stakeholder.newStake = 0;
        } else {
            _totalNewStake[stakeholder.weight] -= amount;
            stakeholder.newStake -= amount;
        }

        stakeholder.withdrawals.push(
            Withdrawal(block.timestamp + cooldown,
            amount));

        
        // If no stake is left in any way,
        // treat the staker as leaving
        if(activeStakeholder(sender) == false){
            stakeholder.startDate = 0;
            weightCounts[stakeholder.weight]--;
            // Check if maxWeight decreased
            handleDecreasingMaxWeight();
            emit Active(sender, false);
        }
        
        emit InitiateWithdraw(sender, amount, block.timestamp + cooldown);

        if(instant){
            withdrawFunds(stakeholder.withdrawals.length-1);
        }

    }

    /**
     * Withdraw staked funds from the contract.
     * Can only be triggered after `requestWithdrawal` has been called.
     * If funds are withdrawn before the cooldown period has passed,
     * a fee will fee deducted. Withdrawing the funds when triggering
     * `requestWithdrawal` will result in a fee equal to `earlyWithdrawalFee`.
     * Waiting until the cooldown period has passed results in no fee.
     * Withdrawing at any other moment between these two periods in time
     * results in a fee that lineairy decreases with time.
     */
    function withdrawFunds(uint withdrawalId) public {
        address sender = _msgSender();
        StakeHolder storage stakeholder = stakeholders[sender];

        require(stakeholder.withdrawals.length > withdrawalId,
            "No withdraw request");
        
        Withdrawal memory withdrawal = stakeholder.withdrawals[withdrawalId];
        // Calculate time passed since withdraw request to calculate fee
        uint timeToEnd = withdrawal.releaseDate >= block.timestamp ? (withdrawal.releaseDate - block.timestamp) : 0;
        uint fee = (cooldown > 0) ? withdrawal.releaseAmount * timeToEnd * earlyWithdrawalFee / (cooldown * decimalPrecision * 100) : 0;

        // Transfer reduced amount to the staker, fee stays in contract
        stakingToken.transfer(sender, withdrawal.releaseAmount - fee);
        emit Withdraw(sender, withdrawal.releaseAmount, fee);

        // Remove the withdrawal request
        stakeholder.withdrawals[withdrawalId] = stakeholder.withdrawals[stakeholder.withdrawals.length-1];
        stakeholder.withdrawals.pop();
    }

    /**
     * Function to claim the rewards earned by staking for the sender.
     * @dev Calls `handleRewards` for the sender
     * @param endPeriod The periods to claim rewards for.
     * @param withdraw if true, send the rewards to the stakeholder.
     *  if false, add the rewards to the staking balance of the stakeholder.
     */
    function claimRewards(uint endPeriod, bool withdraw) public {
        // If necessary, close the current latest period and create a new latest.
        handleNewPeriod(endPeriod);
        address stakeholderAddress = _msgSender();
        handleRewards(endPeriod, withdraw, stakeholderAddress);    
    }

    /**
     * Function to claim the rewards for a list of stakers as owner.
     * No funds are withdrawn, only staking balances are updated.
     * @dev Calls `handleRewards` in a loop for the stakers defined
     * @param stakeholders_ list of stakeholders to claim rewards for
     */
    function claimRewardsAsOwner(address[] memory stakeholders_) public onlyOwner{
        // If necessary, close the current latest period and create a new latest.
        handleNewPeriod(currentPeriod());
        for(uint i = 0; i < stakeholders_.length; i++){
            handleRewards(currentPeriod(), false, stakeholders_[i]);
        }
    }

    /**
     * Function to claim the rewards earned by staking for an address.
     * @dev uses calculateRewards to get the amount owed
     * @param endPeriod The periods to claim rewards for.
     * @param withdraw if true, send the rewards to the stakeholder.
     *  if false, add the rewards to the staking balance of the stakeholder.
     * @param stakeholderAddress address to claim rewards for
     */
    function handleRewards(uint endPeriod, bool withdraw, address stakeholderAddress) internal {
        StakeHolder storage stakeholder = stakeholders[stakeholderAddress];
        
        if(currentPeriod() < endPeriod){
            endPeriod = currentPeriod();
        }
        // Number of periods for which rewards will be paid
        // Current period is not in the interval as it is not finished.
        uint n = (endPeriod > stakeholder.lastClaimed) ? 
            endPeriod - stakeholder.lastClaimed : 0;

        // If no potental stake is present or no time passed since last claim,
        // new rewards do not need to be calculated.
        if (activeStakeholder(stakeholderAddress) == false || n == 0){
                return;
        }

        // Calculate the rewards and new stakeholder state
        (uint reward, uint lockedRewards, StakeHolder memory newStakeholder) = calculateRewards(stakeholderAddress, endPeriod);
        
        // Update stakeholder values
        stakeholder.stakingBalance = newStakeholder.stakingBalance;
        stakeholder.newStake = newStakeholder.newStake;
        stakeholder.lockedRewards = newStakeholder.lockedRewards;

        // Update last claimed and reward definition to use in next calculation
        stakeholder.lastClaimed = endPeriod;

        // If the stakeholder wants to withdraw the rewards,
        // send the funds to his wallet. Else, update stakingbalance.
        if (withdraw){
            rewardPeriods[latestRewardPeriod]._totalStakingBalance[stakeholder.weight] -= reward;
            stakingToken.transfer(_msgSender(), reward);
            // If no stake is left in any way,
            // treat the staker as leaving
            if(activeStakeholder(stakeholderAddress) == false){
                stakeholder.startDate = 0;
                weightCounts[stakeholder.weight]--;
                // Check if maxWeight decreased
                handleDecreasingMaxWeight();
                emit Active(stakeholderAddress, false);
            }
            emit Withdraw(stakeholderAddress, reward, 0);
        } else {
            stakeholder.stakingBalance += reward;
        }

        emit Rewarding(stakeholderAddress, reward, lockedRewards, n);

    }

    /**
     * Calculate the rewards owed to a stakeholder.
     * The interest will be calculated based on:
     *  - The reward to divide in this period
     *  - The the relative stake of the stakeholder (taking previous rewards in account)
     *  - The time the stakeholder has been staking.
     * The formula of compounding interest is applied, meaning rewards on rewards are calculated.
     * @param stakeholderAddress The address to calculate rewards for
     * @param endPeriod The rewards will be calculated until this period.
     * @return reward The rewards of the stakeholder for previous periods that can be claimed instantly.
     * @return lockedRewards The additional locked rewards for this period
     * @return stakeholder The new object containing stakeholder state
     */
    function calculateRewards(address stakeholderAddress, uint endPeriod) public view returns(uint reward, uint lockedRewards, StakeHolder memory stakeholder) {

        stakeholder = stakeholders[stakeholderAddress];
        
        // Number of periods for which rewards will be paid
        // lastClaimed is included, currentPeriod not.
        uint n = (endPeriod > stakeholder.lastClaimed) ? 
            endPeriod - stakeholder.lastClaimed : 0;

        // If no stake is present or no time passed since last claim, 0 can be returned.
        if (activeStakeholder(stakeholderAddress) == false || n == 0){
                return (0, 0, stakeholder);
        }

        uint currentStake = stakeholder.stakingBalance;
        uint initialLocked = stakeholder.lockedRewards;

        // Loop over all following intervals to calculate the rewards for following periods.
        uint twsb;
        uint rpp;
        uint erm;
        uint[] memory tsb = new uint[](rewardPeriods[latestRewardPeriod].maxWeight+1);
        uint[] memory tlr = new uint[](rewardPeriods[latestRewardPeriod].maxWeight+1);

        // Loop over over all periods.
        // Start is last claimed date,
        // end is capped by the smallest of:
        // - the endPeriod function parameter
        // - the max number of periods for which rewards are distributed
        for (uint p = stakeholder.lastClaimed;
            p < (endPeriod > maxNumberOfPeriods ? maxNumberOfPeriods : endPeriod);
            p++) {

            uint extraReward;
            // If p is smaller than the latest reward period registered,
            // calculate the rewards based on state
            if(p <= latestRewardPeriod){
                twsb = totalStakingBalance(p,1);
                erm = rewardPeriods[p].extraRewardMultiplier;
                if(p<latestRewardPeriod){
                    rpp = rewardPeriods[p].rewardPerPeriod;
                }
                else {
                    rpp = calculateRewardPerPeriod();
                }
            }
            // If p is bigger, simulate the behaviour of `handleNewPeriod`
            // and `_totalStakingBalance` with the current state of the last period.
            // This part is never used in `claimRewards` as the state is updated first
            // but it is needed when directly calling this function to:
            // - calculating current rewards before anyone triggered `handleNewPeriod`
            // - forecasting expected returns with a period in the future
            else {
                // Initialize first simulation
                if(p == latestRewardPeriod + 1){
                    for(uint i = 0; i<=rewardPeriods[latestRewardPeriod].maxWeight; i++){
                        tsb[i]=rewardPeriods[latestRewardPeriod]._totalStakingBalance[i];
                        tlr[i]=_totalLockedRewards[i];
                    }
                }

                // Add rewards of last period
                for(uint i = 0; i<=rewardPeriods[latestRewardPeriod].maxWeight; i++){
                    uint newReward = 0;
                    if(twsb > 0){
                        newReward = (tsb[i]*(twsb+rpp*(i+1)) / twsb) - tsb[i];
                        tsb[i] += newReward;
                    }

                    if(p % periodsForExtraReward == 1){
                        tsb[i] += tlr[i]
                                + newReward * erm / (decimalPrecision);
                        tlr[i] = 0;
                    } else {
                        tlr[i] += newReward * erm / (decimalPrecision);
                    }
                }
                // Add new stake of last period (only first simulation)
                if(p == latestRewardPeriod + 1){
                    for(uint i = 0; i<=rewardPeriods[latestRewardPeriod].maxWeight; i++){
                        tsb[i] += _totalNewStake[i];
                    }
                } 

                // Calculate weighted staking balance for reward calculation
                twsb = 0;
                for(uint i = 0; i<=rewardPeriods[latestRewardPeriod].maxWeight; i++){
                    twsb += tsb[i]*(i+1);
                }               

            }

            // Update the new stake
            if(twsb > 0){
                uint newReward = (currentStake*(twsb + (stakeholder.weight+1) * rpp) / twsb) - currentStake;
                currentStake += newReward;
                reward += newReward;
                extraReward = newReward*erm/(decimalPrecision);
            }

            if(stakeholder.newStake > 0){
                // After reward last period with old stake, add it to balance
                currentStake += stakeholder.newStake;
                stakeholder.stakingBalance += stakeholder.newStake;
                stakeholder.newStake = 0;
            }

            // Calculate extra reward from new reward
            if(p % periodsForExtraReward == 0){
                // Add earlier earned extra rewards to the stake
                currentStake += stakeholder.lockedRewards;
                // Add new extra rewards to the stake
                currentStake += extraReward;
                // Update total reward
                reward += extraReward + stakeholder.lockedRewards;
                // Reset initial locked tokens, these are not locked anymore
                initialLocked = 0;
                stakeholder.lockedRewards = 0;
            } else {
                stakeholder.lockedRewards += extraReward;
            }

        }

        lockedRewards = stakeholder.lockedRewards - initialLocked;
    }


    /**
     * Checks if the signature is created out of the contract address, sender and new weight,
     * signed by the private key of the signerAddress
     * @param sender the address of the message sender
     * @param weight amount of tokens to mint
     * @param signature a signature of the contract address, senderAddress and tokensId.
     *   Should be signed by the private key of signerAddress.
     */
    function _recoverSigner(address sender, uint weight, bytes memory signature) public view returns (address){
        return ECDSA.recover(ECDSA.toEthSignedMessageHash(keccak256(abi.encode(address(this), sender, weight))) , signature);
    }

    /**
     * Owner function to transfer the staking token from the contract
     * address to the contract owner.
     * The amount cannot exceed the amount staked by the stakeholders,
     * making sure the funds of stakeholders stay in the contract.
     * Unclaimed rewards and locked rewards cannot be withdrawn either.
     * @param amount the amount to withraw as owner
     */
    function withdrawRemainingFunds(uint amount) public onlyOwner{

        // Make sure the staked amounts rewards are never withdrawn
        if(amount > stakingToken.balanceOf(address(this))
            - totalStakingBalance(latestRewardPeriod,0) 
            - totalNewStake(0)
            - totalLockedRewards(0)){
                amount = stakingToken.balanceOf(address(this))
                            - totalStakingBalance(latestRewardPeriod,0) 
                            - totalNewStake(0)
                            - totalLockedRewards(0);
        }

        stakingToken.transfer(owner(), amount);
    }

    /**
     * Update the address used to verify signatures
     * @param value the new address to use for verification
     */
    function updateSignatureAddress(address value) public onlyOwner {
        signatureAddress = value; 
    }

    /**
     * @param value the new end date after which rewards will stop
     */
    function updateMaxNumberOfPeriods(uint value) public onlyOwner {
        maxNumberOfPeriods = value; 
        emit ConfigUpdate('Max number of periods', value);
    }

    /**
     * Updates the cooldown period.
     * @param value The new cooldown per period
     */
    function updateCoolDownPeriod(uint value) public onlyOwner{
        cooldown = value;
        emit ConfigUpdate('Cool down period', value);
    }

    /**
     * Updates the early withdraw fee.
     * @param value The new fee
     */
    function updateEarlyWithdrawalFee(uint value) public onlyOwner{
        earlyWithdrawalFee = value;
        emit ConfigUpdate('New withdraw fee', value);
    }

    /**
     * Updates the extra reward multiplier, starting instantly.
     * Take into account this value will be divided by decimalPrecision
     * in order to allow multipliers < 1 up to 0.000001.
     * @param value The new reward per period
     */
    function updateExtraRewardMultiplier(uint value) public onlyOwner{
        handleNewPeriod(currentPeriod());       
        rewardPeriods[latestRewardPeriod].extraRewardMultiplier = value;
        emit ConfigUpdate('Extra reward multiplier', value);
    }

    /**
     * Calculates how many reward periods passed since the start.
     * @return period the current period
     */
    function currentPeriod() public view returns(uint period){
        period = (block.timestamp - startDate) / rewardPeriodDuration;
        if(period > maxNumberOfPeriods){
            period = maxNumberOfPeriods;
        }
    }

    /**
     * Updates maxWeight in case there are no stakeholders with this weight left
     */
    function handleDecreasingMaxWeight() public {
        if (weightCounts[rewardPeriods[latestRewardPeriod].maxWeight] == 0 && rewardPeriods[latestRewardPeriod].maxWeight > 0){
            for(uint i = rewardPeriods[latestRewardPeriod].maxWeight - 1; 0 <= i; i--){
                if(weightCounts[i] > 0 || i == 0){
                    rewardPeriods[latestRewardPeriod].maxWeight = i;
                    break;
                }
            }
        }        
    }

    /**
     * Checks if a stakeholder is still active
     * Active stakeholders have at least one of following things:
     * - positive staking balance
     * - positive new stake to be added next period
     * - positive locked tokens that can come in circulation 
     * @return active true if stakeholder holds active balance
     */
    function activeStakeholder(address stakeholderAddress) public view returns(bool active) {
        return (stakeholders[stakeholderAddress].stakingBalance > 0
            || stakeholders[stakeholderAddress].newStake > 0
            || stakeholders[stakeholderAddress].lockedRewards > 0);
    }

}



