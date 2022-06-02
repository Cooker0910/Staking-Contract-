
# `EnvoyStaking`

A staking contract for Envoy tokens








## Variables:
- [`mapping(address => struct EnvoyStaking.StakeHolder) stakeholders`](#EnvoyStaking-stakeholders-mapping-address----struct-EnvoyStaking-StakeHolder-)
- [`mapping(uint256 => struct EnvoyStaking.RewardPeriod) rewardPeriods`](#EnvoyStaking-rewardPeriods-mapping-uint256----struct-EnvoyStaking-RewardPeriod-)
- [`uint256 latestRewardPeriod`](#EnvoyStaking-latestRewardPeriod-uint256)
- [`mapping(uint256 => uint256) _totalNewStake`](#EnvoyStaking-_totalNewStake-mapping-uint256----uint256-)
- [`mapping(uint256 => uint256) _totalLockedRewards`](#EnvoyStaking-_totalLockedRewards-mapping-uint256----uint256-)
- [`mapping(uint256 => uint256) weightCounts`](#EnvoyStaking-weightCounts-mapping-uint256----uint256-)
- [`address signatureAddress`](#EnvoyStaking-signatureAddress-address)
- [`contract IERC20 stakingToken`](#EnvoyStaking-stakingToken-contract-IERC20)
- [`uint256 startDate`](#EnvoyStaking-startDate-uint256)
- [`uint256 maxNumberOfPeriods`](#EnvoyStaking-maxNumberOfPeriods-uint256)
- [`uint256 rewardPeriodDuration`](#EnvoyStaking-rewardPeriodDuration-uint256)
- [`uint256 periodsForExtraReward`](#EnvoyStaking-periodsForExtraReward-uint256)
- [`uint256 cooldown`](#EnvoyStaking-cooldown-uint256)
- [`uint256 earlyWithdrawalFee`](#EnvoyStaking-earlyWithdrawalFee-uint256)
- [`string name`](#EnvoyStaking-name-string)
- [`string symbol`](#EnvoyStaking-symbol-string)
- [`uint256 decimals`](#EnvoyStaking-decimals-uint256)


## List of functions:
- [`constructor(uint256 maxNumberOfPeriods_, uint256 rewardPeriodDuration_, uint256 periodsForExtraReward_, uint256 extraRewardMultiplier_, uint256 cooldown_, uint256 earlyWithdrawalFee_, address signatureAddress_, address stakingTokenAddress) (public)`](#EnvoyStaking-constructor-uint256-uint256-uint256-uint256-uint256-uint256-address-address-)
- [`totalStakingBalance(uint256 period, uint256 weightExponent) → uint256 totalStaking (public)`](#EnvoyStaking-totalStakingBalance-uint256-uint256-)
- [`totalNewStake(uint256 weightExponent) → uint256 totalNew (public)`](#EnvoyStaking-totalNewStake-uint256-)
- [`totalLockedRewards(uint256 weightExponent) → uint256 totalLocked (public)`](#EnvoyStaking-totalLockedRewards-uint256-)
- [`handleNewPeriod(uint256 endPeriod) (public)`](#EnvoyStaking-handleNewPeriod-uint256-)
- [`increaseWeight(uint256 weight_, bytes signature) (public)`](#EnvoyStaking-increaseWeight-uint256-bytes-)
- [`updateWeightBatch(address[] stakeholders_, uint256[] weights_) (public)`](#EnvoyStaking-updateWeightBatch-address---uint256---)
- [`stake(uint256 amount) (public)`](#EnvoyStaking-stake-uint256-)
- [`requestWithdrawal(uint256 amount, bool instant, bool claimRewardsFirst) (public)`](#EnvoyStaking-requestWithdrawal-uint256-bool-bool-)
- [`withdrawFunds() (public)`](#EnvoyStaking-withdrawFunds--)
- [`claimRewards(uint256 endPeriod, bool withdraw) (public)`](#EnvoyStaking-claimRewards-uint256-bool-)
- [`claimRewardsAsOwner(address[] stakeholders_) (public)`](#EnvoyStaking-claimRewardsAsOwner-address---)
- [`handleRewards(uint256 endPeriod, bool withdraw, address stakeholderAddress) (internal)`](#EnvoyStaking-handleRewards-uint256-bool-address-)
- [`calculateRewards(address stakeholderAddress, uint256 endPeriod) → uint256 reward, uint256 lockedRewards, struct EnvoyStaking.StakeHolder stakeholder (public)`](#EnvoyStaking-calculateRewards-address-uint256-)
- [`_recoverSigner(address sender, uint256 weight, bytes signature) → address (public)`](#EnvoyStaking-_recoverSigner-address-uint256-bytes-)
- [`withdrawRemainingFunds(uint256 amount) (public)`](#EnvoyStaking-withdrawRemainingFunds-uint256-)
- [`updateSignatureAddress(address value) (public)`](#EnvoyStaking-updateSignatureAddress-address-)
- [`updateMaxNumberOfPeriods(uint256 value) (public)`](#EnvoyStaking-updateMaxNumberOfPeriods-uint256-)
- [`updateCoolDownPeriod(uint256 value) (public)`](#EnvoyStaking-updateCoolDownPeriod-uint256-)
- [`updateEarlyWithdrawalFee(uint256 value) (public)`](#EnvoyStaking-updateEarlyWithdrawalFee-uint256-)
- [`updateExtraRewardMultiplier(uint256 value) (public)`](#EnvoyStaking-updateExtraRewardMultiplier-uint256-)
- [`currentPeriod() → uint256 period (public)`](#EnvoyStaking-currentPeriod--)
- [`handleDecreasingMaxWeight() (public)`](#EnvoyStaking-handleDecreasingMaxWeight--)
- [`activeStakeholder(address stakeholderAddress) → bool active (public)`](#EnvoyStaking-activeStakeholder-address-)
- [`balanceOf(address stakeholderAddress) → uint256 balance (public)`](#EnvoyStaking-balanceOf-address-)
- [`checkUpkeep(bytes) → bool upkeepNeeded, bytes (public)`](#EnvoyStaking-checkUpkeep-bytes-)
- [`performUpkeep(bytes) (external)`](#EnvoyStaking-performUpkeep-bytes-)

## Events:
- [`ConfigUpdate(string field_, uint256 value_)`](#EnvoyStaking-ConfigUpdate-string-uint256-)
- [`Staking(address stakeholder_, uint256 stake_)`](#EnvoyStaking-Staking-address-uint256-)
- [`Rewarding(address stakeholder_, uint256 reward_, uint256 lockedReward_, uint256 numberOfPeriods_)`](#EnvoyStaking-Rewarding-address-uint256-uint256-uint256-)
- [`InitiateWithdraw(address stakeholder_, uint256 amount_, uint256 releaseDate_)`](#EnvoyStaking-InitiateWithdraw-address-uint256-uint256-)
- [`Withdraw(address stakeholder_, uint256 amount_, uint256 fee_)`](#EnvoyStaking-Withdraw-address-uint256-uint256-)
- [`Active(address stakeholder_, bool active_)`](#EnvoyStaking-Active-address-bool-)



## Functions:
### Function `constructor(uint256 maxNumberOfPeriods_, uint256 rewardPeriodDuration_, uint256 periodsForExtraReward_, uint256 extraRewardMultiplier_, uint256 cooldown_, uint256 earlyWithdrawalFee_, address signatureAddress_, address stakingTokenAddress) (public)` {#EnvoyStaking-constructor-uint256-uint256-uint256-uint256-uint256-uint256-address-address-}

Sets a number of initial state variables


### Function `totalStakingBalance(uint256 period, uint256 weightExponent) → uint256 totalStaking (public)` {#EnvoyStaking-totalStakingBalance-uint256-uint256-}

Calculates the staking balance for a certain period.
Can provide the current balance or balance to be added next period.
Also weighted (or multiple weighted) balances can be returned



#### Parameters:
- `period`: The period for which to call the balance

- `weightExponent`: How many times does the stake need to be multiplied with the weight?

#### Return Values:
- totalStaking the total amount staked for the parameters.
### Function `totalNewStake(uint256 weightExponent) → uint256 totalNew (public)` {#EnvoyStaking-totalNewStake-uint256-}

Calculates the new staking balance accumulated in the current period.
Also weighted (or multiple weighted) balances can be returned



#### Parameters:
- `weightExponent`: How many times does the stake need to be multiplied with the weight?

#### Return Values:
- totalNew the total new amount staked to be included next period.
### Function `totalLockedRewards(uint256 weightExponent) → uint256 totalLocked (public)` {#EnvoyStaking-totalLockedRewards-uint256-}

Calculates the new total locked rewards accumulated since latest unlock date.
Also weighted (or multiple weighted) balances can be returned



#### Parameters:
- `weightExponent`: How many times does the stake need to be multiplied with the weight?

#### Return Values:
- totalLocked the total new amount staked to be included next period.
### Function `handleNewPeriod(uint256 endPeriod) (public)` {#EnvoyStaking-handleNewPeriod-uint256-}

Function to call when a new reward period is entered.
The function will increment the maxRewardPeriod field,
making the state of previous period immutable.
The state will use the state of the last period as start for the current period.
The total staking balance is updated with:
- stake added in previous period
- rewards earned in previous period
- locked tokens, if they are unlocked.



#### Parameters:
- `endPeriod`: the last period the function should handle.
 cannot exceed the current period.
### Function `increaseWeight(uint256 weight_, bytes signature) (public)` {#EnvoyStaking-increaseWeight-uint256-bytes-}

Increase the stake of the sender by a value.



#### Parameters:
- `weight_`: The new weight.

- `signature`: A signature proving the sender
 is allowed to update his weight.
### Function `updateWeightBatch(address[] stakeholders_, uint256[] weights_) (public)` {#EnvoyStaking-updateWeightBatch-address---uint256---}

Update the stake of a list of stakeholders as owner.



#### Parameters:
- `stakeholders_`: The stakeholders

- `weights_`: The new weights.
 is allowed to update his weight.
### Function `stake(uint256 amount) (public)` {#EnvoyStaking-stake-uint256-}

Increase the stake of the sender by a value.



#### Parameters:
- `amount`: The amount to stake
### Function `requestWithdrawal(uint256 amount, bool instant, bool claimRewardsFirst) (public)` {#EnvoyStaking-requestWithdrawal-uint256-bool-bool-}

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


### Function `withdrawFunds() (public)` {#EnvoyStaking-withdrawFunds--}

Withdraw staked funds from the contract.
Can only be triggered after `requestWithdrawal` has been called.
If funds are withdrawn before the cooldown period has passed,
a fee will fee deducted. Withdrawing the funds when triggering
`requestWithdrawal` will result in a fee equal to `earlyWithdrawalFee`.
Waiting until the cooldown period has passed results in no fee.
Withdrawing at any other moment between these two periods in time
results in a fee that lineairy decreases with time.


### Function `claimRewards(uint256 endPeriod, bool withdraw) (public)` {#EnvoyStaking-claimRewards-uint256-bool-}

Function to claim the rewards earned by staking for the sender.


Calls `handleRewards` for the sender

#### Parameters:
- `endPeriod`: The periods to claim rewards for.

- `withdraw`: if true, send the rewards to the stakeholder.
 if false, add the rewards to the staking balance of the stakeholder.
### Function `claimRewardsAsOwner(address[] stakeholders_) (public)` {#EnvoyStaking-claimRewardsAsOwner-address---}

Function to claim the rewards for a list of stakers as owner.
No funds are withdrawn, only staking balances are updated.


Calls `handleRewards` in a loop for the stakers defined

#### Parameters:
- `stakeholders_`: list of stakeholders to claim rewards for
### Function `handleRewards(uint256 endPeriod, bool withdraw, address stakeholderAddress) (internal)` {#EnvoyStaking-handleRewards-uint256-bool-address-}

Function to claim the rewards earned by staking for an address.


uses calculateRewards to get the amount owed

#### Parameters:
- `endPeriod`: The periods to claim rewards for.

- `withdraw`: if true, send the rewards to the stakeholder.
 if false, add the rewards to the staking balance of the stakeholder.

- `stakeholderAddress`: address to claim rewards for
### Function `calculateRewards(address stakeholderAddress, uint256 endPeriod) → uint256 reward, uint256 lockedRewards, struct EnvoyStaking.StakeHolder stakeholder (public)` {#EnvoyStaking-calculateRewards-address-uint256-}

Calculate the rewards owed to a stakeholder.
The interest will be calculated based on:
 - The reward to divide in this period
 - The the relative stake of the stakeholder (taking previous rewards in account)
 - The time the stakeholder has been staking.
The formula of compounding interest is applied, meaning rewards on rewards are calculated.



#### Parameters:
- `stakeholderAddress`: The address to calculate rewards for

- `endPeriod`: The rewards will be calculated until this period.

#### Return Values:
- reward The rewards of the stakeholder for previous periods that can be claimed instantly.

- lockedRewards The additional locked rewards for this period

- stakeholder The new object containing stakeholder state
### Function `_recoverSigner(address sender, uint256 weight, bytes signature) → address (public)` {#EnvoyStaking-_recoverSigner-address-uint256-bytes-}

Checks if the signature is created out of the contract address, sender and new weight,
signed by the private key of the signerAddress



#### Parameters:
- `sender`: the address of the message sender

- `weight`: amount of tokens to mint

- `signature`: a signature of the contract address, senderAddress and tokensId.
  Should be signed by the private key of signerAddress.
### Function `withdrawRemainingFunds(uint256 amount) (public)` {#EnvoyStaking-withdrawRemainingFunds-uint256-}

Owner function to transfer the staking token from the contract
address to the contract owner.
The amount cannot exceed the amount staked by the stakeholders,
making sure the funds of stakeholders stay in the contract.
Unclaimed rewards and locked rewards cannot be withdrawn either.



#### Parameters:
- `amount`: the amount to withraw as owner
### Function `updateSignatureAddress(address value) (public)` {#EnvoyStaking-updateSignatureAddress-address-}

Update the address used to verify signatures



#### Parameters:
- `value`: the new address to use for verification
### Function `updateMaxNumberOfPeriods(uint256 value) (public)` {#EnvoyStaking-updateMaxNumberOfPeriods-uint256-}




#### Parameters:
- `value`: the new end date after which rewards will stop
### Function `updateCoolDownPeriod(uint256 value) (public)` {#EnvoyStaking-updateCoolDownPeriod-uint256-}

Updates the cooldown period.



#### Parameters:
- `value`: The new cooldown per period
### Function `updateEarlyWithdrawalFee(uint256 value) (public)` {#EnvoyStaking-updateEarlyWithdrawalFee-uint256-}

Updates the early withdraw fee.



#### Parameters:
- `value`: The new fee
### Function `updateExtraRewardMultiplier(uint256 value) (public)` {#EnvoyStaking-updateExtraRewardMultiplier-uint256-}

Updates the extra reward multiplier, starting instantly.
Take into account this value will be divided by 10**6
in order to allow multipliers < 1 up to 0.000001.



#### Parameters:
- `value`: The new reward per period
### Function `currentPeriod() → uint256 period (public)` {#EnvoyStaking-currentPeriod--}

Calculates how many reward periods passed since the start.



#### Return Values:
- period the current period
### Function `handleDecreasingMaxWeight() (public)` {#EnvoyStaking-handleDecreasingMaxWeight--}

Updates maxWeight in case there are no stakeholders with this weight left


### Function `activeStakeholder(address stakeholderAddress) → bool active (public)` {#EnvoyStaking-activeStakeholder-address-}

Checks if a stakeholder is still active
Active stakeholders have at least one of following things:
- positive staking balance
- positive new stake to be added next period
- positive locked tokens that can come in circulation 



#### Return Values:
- active true if stakeholder holds active balance
### Function `balanceOf(address stakeholderAddress) → uint256 balance (public)` {#EnvoyStaking-balanceOf-address-}

Returns the tokens staked, the rewards earned and locked tokens as balance for a stakeholder.
Used in applications expecting the ERC20 interface, e.g. Metamask



#### Parameters:
- `stakeholderAddress`: the address to return the balance for

#### Return Values:
- balance the sum of total stakingbalance, reward and locked tokens
### Function `checkUpkeep(bytes) → bool upkeepNeeded, bytes (public)` {#EnvoyStaking-checkUpkeep-bytes-}




### Function `performUpkeep(bytes) (external)` {#EnvoyStaking-performUpkeep-bytes-}





## Events

### Event `ConfigUpdate(string field_, uint256 value_)` {#EnvoyStaking-ConfigUpdate-string-uint256-}
Emits when a config field is updated
    @param field_ of the field
    @param value_ new value of the field
No description
### Event `Staking(address stakeholder_, uint256 stake_)` {#EnvoyStaking-Staking-address-uint256-}
Emits when new address stakes
    @param stakeholder_ address of the stakeholder
    @param stake_ new amount of staked tokens
No description
### Event `Rewarding(address stakeholder_, uint256 reward_, uint256 lockedReward_, uint256 numberOfPeriods_)` {#EnvoyStaking-Rewarding-address-uint256-uint256-uint256-}
Emits when stakeholder claims rewards
    @param stakeholder_ address of the stakeholder
    @param reward_ reward claimed
    @param lockedReward_ amount of additional reward that is locked
    @param numberOfPeriods_ number of periods rewarded
No description
### Event `InitiateWithdraw(address stakeholder_, uint256 amount_, uint256 releaseDate_)` {#EnvoyStaking-InitiateWithdraw-address-uint256-uint256-}
Emits when a stakeholder requested a withdrawal
     @param stakeholder_ address of the stakeholder
     @param amount_ amount of tokens withdrawn from the contract 
     @param releaseDate_ timestamp when cooldown is over for the user
No description
### Event `Withdraw(address stakeholder_, uint256 amount_, uint256 fee_)` {#EnvoyStaking-Withdraw-address-uint256-uint256-}
Emits when a stakeholder finalizes a withdrawal
     @param stakeholder_ address of the stakeholder
     @param amount_ amount of tokens sent to the stakeholder
     @param fee_ fee paid for early withdrawal
No description
### Event `Active(address stakeholder_, bool active_)` {#EnvoyStaking-Active-address-bool-}
Emits when a new staker enters the contract by staking or existing stakeholder leaves by withdrawing
     @param stakeholder_ address of the stakeholder
     @param active_ yes if the staker becomes active, false if inactive
No description
