# Contract implementation

## Contract state

The contract is implemented to keep track of two states in 2 mappings of structs:

### State for each stakeholder

The state of each staker, mapping the stakeholder's address to a struct containing:

* The **staking balance** or amount staked
* The **new staking balance**, the amount that is staked but not yet used in the reward calculation because it was not staked for a full period.
* The **weight** or level of each stakeholder to multiply the staking balance with in the reward calculation
* The **start date** or date the staker joined
* The date the stakeholder claimed the last rewards
* The **release date** on which the stakeholder is able to withdraw the staked funds
* The amount the staker can withdraw after the release date
* The amount of **locked tokens** that can be claimed after the next unlock date

### State of the period

The state of each interval for which rewards are divided, mapping the sequential number of the reward period to a struct containing:

* The **reward per period** or amount to distribute over all stakeholders based on their weighted stake. The reward will be the total token balance in the contract (exlcuding the funds staked by users, unclaimed rewards and locked tokens) divided by the remaining periods that will be rewarded before the contract ends. If no one staked for a period, the reward will be 0. When opening a new period, the value is copied from previous period. When closing a period, the reward for this period will be calculated.
* The **extra reward multiplier** which is used to calculate the bonus reward on each reward, resulting in locked tokens for the user. It resembles a percentage times 10^6 (in order to be able to have a percentage lower than 1). If the bonus should be 10% of the reward, set the value to 10*10^6. The bonus will be calculated via: ```bonus = reward * 10*10^6/10^8```
* The **maximum weight** of this period, used to loop over the mappings taking **weight** as key (see next bullet points).
* The **total staking balance** for each weight, kept in a mapping. It is kept in a small mapping instead of a single integer to be able to calculate the total weighted reward each period.
* The **total new staking balance** for each weight in a mapping, similar to the new staking balance field in the struct for single stakeholders
* The **total rewards claimed** for each weight, keeping track of how many rewards were actually claimed (and indirectly how many rewards still need to be distributed.

The key is how many reward periods have passed during the life time of the contract. The current period is calculated based on two state variables (the **start time of the contract** and the **duration of a reward period** set in the constructor) and the current block time.  The formula is the difference of the start time and the current time,  divided by the duration of a period. The formula is triggered by the `currentPeriod` function. When a period ends, a struct for the next period will be initialized in the mapping, based on the previous period and all changes to be applied. This happens in the `handleNewPeriod` function. The function can be triggered manually, but is also triggered when users interact with the contract to update the state (for example when .staking, updating weight, claiming or initializing a withdraw). Not all periods need to be handled in one transaction (to avoid having transactions that revert due to gas costs), so `handleNewPeriod` takes an integer as argument which tells the function until which reward period updates need to be triggered. The **latest reward period** that is handled already is saved in a global variable.

### Global contract variables

These 2 states are the most important other global variables are:

* A mapping from user weight to the **total amount of locked rewards** in the contract. This mapping is used to save all locked rewards. When the next unlock date is reached, the locked rewards are added to the staking balance and reset.
* A mapping containing **counts of stakers per weight** in order to have a distribution of stakeholder weights on the one hand, and to be able to decrease the highest weight for a period.
* The **signature address** used to verify users updating weight are allowed to do so. Can be updated by the owner.
* The **staking token contract** for which staking applies. Set in the constructor and immutable.
* The **start date** equalling the block time of deployment, used to calculate how many periods have passed
* The **max number of periods** for which rewards will be paid, used to cap the end date in the reward calculation. It will be used to calculate the reward for each period, which is the `amount to distribute/remaining periods`. Can be updated by the owner.
* The **reward period duration** or length in between reward distribution, set at deployment and immutable.
* The **periods for extra reward** or the number of periods after which locked tokens are released. Again, immutable.
* The **cooldown** period or length between withdrawal request and withdrawal without fee is possible. Can be updated by the owner.
* The **early withdrawal fee** penalizing early withdrawal. This will be a percentage times 10**6. Can be updated by the owner.
* The **name**, **symbol** and **decimals** field for the ERC20 interface

## Handeling time

Time is expressed in reward periods, for which the duration is set in the constructor and cannot be changed afterwards. The current period is how many full reward periods have passed since the deployment of the contract. This value can be fetched with the `currentPeriod`function. There is a hard limit on how any reward periods will be rewarded, defined by the `maxNumberOfPeriods` state variable. Once this is reached, the current period will stay at this value. The value can be increased by the owner if the lifetime of the contract is expanded.

When the reward period is over, users can claim the rewards they earned. As compounding is used, the rewards earned here need to be taken into account for the periods to come. To avoid forcing users to manually claim each period, the state of each period is kept. When a stakeholder has the history of total balances and rewards per period in the past, a staker can calculate his earned rewards on any number of past periods.

The function used to to this, `handleNewPeriod`, takes one integer `endPeriod` as an argument. It will handle all new periods in between the last period for which the state was saved and `endPeriod`. End period cannot exceed the current period. Functions that update the state (e.g. `stake`, `claimRewards`, `increaseWeight`, `requestWithdraw`,...) first trigger this function with `currentPeriod()` as argument to update all passed periods. After the past states are saved, the current state is updated by the changes applied by the functions.

For each period handled, the reward per period, extra reward multiplier and maximum weight are copied. Initially, they are the same. When one of these values is updated, only the last period is updated so we keep the history of the earlier state.

The total staking balance is also updated for each weight. The newly added stake of previous period (for which no rewards were rewarded) is added to the staking balance (because from this period and onwards it will be included in the reward calculation). The total amount of rewards is past period is also added to the staking balance. The total staking balance will increase with the total reward distributed in the previous period. For each period `i` and weight `w`, the formula becomes:

```totalStake(i, w) += w * totalStake(i-1, w) * (rewardPerPeriod(i-1) / totalWeightedStakingBalance(i-1))```

The step above only happens when the total total weighted staking balance for the latest period is not equal to 0. In the edge-case situation that this value equals 0, there were no stakers and no rewards were distributed. Hence, the total stake for this period should not increase.

If the release date for the locked tokens is not yet reached, the total locked reward for each weight is also updated.  The reward from the formula above is multiplied by the multiplier from previous period and added to the `totalLockedRewards` mapping. At the moment the release date is reached, it is added to the staking balance for this period and `totalLockedRewards` is set to 0.

The contract can handle the update of multiple periods at once, using the deterministic data from the latest reward period. However, the *reward per period* is linked to the token balance and history can not be retrieved from the latest state when multiple periods have passed. The increase in the token amount to reward will be spread over all past periods equally, while the increase might have been lower in the first period and higher in the last period. *on average*, the total rewards distributed are the same, but some periods might reward too much and other too little. This doesn't mean the contract does not work, because over the total period each stakerholder will get the correct amount.

Too help with keeping the contract up to date, we use the Keepers solution of [Chainlink](https://docs.chain.link/docs/chainlink-keepers/introduction/). The solution will check if the contract is up to date, and update if necessary. The `checkUpkeep` and `performUpkeep` handle this logic.

## Checking active users

Checking if a user is active can be done with the `activeStakeholder` function, which takes the user as an argument. A user is active if he has one of following things:

* active stake
* new stake, whcih will become active after it was staked for a full period
* locked tokens, which will become active after the unlock date

We keep track of active users in the `weightCounts` mapping. This mapping stores a distribution of the weights. When a user becomes active, the count for his weight increases. When he withdraws all funds, he gets deactivated and the weight count decreases. To get a count of all users, loop over this mapping from 0 to the `maxWeight` property of the last user.

Checking if a user is active happens when:

* Users stake: incative stakers are activated
* Users update their weight: if the stakeholder is active, weightCounts decreases for the current weight and increases for the new
* Reward calculations: reward calculations are skipped for inactive users because it is always 0
* Withdrawing funds: when withdrawing the full stake and no tokens are locked anymore, the user gets activated.

## Calculating the total stake

Calculating the total stake for a period is necessary to calculate the rewards. For reward calculation, we have to keep track of the total weighted stake for a period. This equals to the sum of the balance of each weight, multiplied by the weight. In order to make this calculation, stake is stored:

* **per period** for backwards calculation in time
* **per weight** in order to calculate the total staking balance

The `totalStakingBalance` function handles this calculation. The arguments expected are:

* The **period** for which you are calculating the total weight
* The **weight exponent**: use 0 for the total stake, 1 for the weighted stake
* A boolean **new stake**, specifying if you want the active stake (false) or the newly added stake that does not generate rewards yet (true)

and it returns the total (weighted) stake for a period. When called with `latestRewardPeriod` as argument, you should get the current state (here, it is assumed `handleNewPeriod` was triggered and the contract state is up to date, otherwise trigger it first).

The total locked rewards are also kept in a mapping for each weight, but not for each period. It increases, until the unlock date is reached. Then it is added to the stake and reset to 0. To get the total locked reward for each weight, loop over the `totalLockedRewards` mapping from 0 to `maxWeight` of the last period in the `rewardPeriods` mapping.

## Staking new funds

Staking new funds can be done via the `stake` function, which only takes the amount to stake as argument. As it adjusts the state, previous rewards are handled first with the old state using `claimRewards(currentPeriod(), false)`. Before triggering this function, the staking contract should also be approved to transfer the amount tokens from the staker to the staking address.

The function will transfer the tokens to the contract and update the `newStake` of the user. It will also increase the total new stake for the stakeholders' weight and this period with this amount. 

If a staker was not an active staker yet, he is initialized:

* his start date and last claim date are set
* the `weightCounts` mapping is incremented by 1 for the weight of the new user to keep track of the staker distribution
* `maxWeight` is adjusted if needed (this value is only checked and potentially updated in `increaseWeight` when the staker is already active, which is not the case)

## Updating stakeholder weights

There are 2 functions to update the weight for a specific user.

### Update your own weight as stakeholder

The first one, `increaseWeight` is for the stakeholders themselves. To do so, they need a signature that verifies that they are allowed to update their weight. The signature is calculated off-chain based on a hash of:

* The contract address
* The stakeholders address
* The new weight

and is signed by the private key of `signatureAddress`. Only the enitity behind the staking contract has this private key, the resulting address is stored in the contract. When updating weight, the signature the user provides will be checked; if it was not singed by `signatureAddress`, the action reverts. This ensures only allowed stakeholders update their weight.

### Manage the weights as contract owner

The other function `updateWeightsBatch` is for the contract owner. It takes an array with addresses and an array with weights as input, but doesn't require the signature. For each value in the arrays (which should have equal length), the weight is updated. In the end, a possible decrease of `maxWeight` is checked. When no stakers have the highest weight anymore, the highest weight is updated to the next highest weight based on the `weightCounts` mapping.

The steps taken to update weight are the same in both functions:

* Claim rewards with the previous weight, so new rewards start with the new weight.
* For active users, check if the weight is higher than the highest weight and if so, increase `maxWeight` for the latest period.
* For active users, update the total staking balance, total new stake, total locked tokens and weight count mappings. These mappings take the user weight as key, so the values of the stakeholder should be subtracted from the *old* weights and added to the *new* weight.

In the end, the weight of the stakeholder is updated so he receives rewards based on the new weight in the future.

## Rewards

### Calculating rewards

The `calculateRewards` function calculates the rewards for a stakeholder. It is a view function, so it doesn't update the state and can be called without gas costs. The function takes the address of the stakeholder as input, and also the end period for the reward calculation. The formula for reward calculation is:

``` javascript
reward = rewardsPerPeriod * (userStakingBalance * userWeight) / totalWeightedStakingBalance
```

The function will loop over all period between start and end date for the calculation and apply this function. The start date for the calculation is always the last period the stakeholder claimed. The end date can be any date specified in the function arguments:

* The current period, to calculate the rewards the user can claim
* A period in the past, to allow claiming part of the rewards.
* A period in the future, to forecast future rewards based on the information of the latest period.The resulted reward will be added to the users stake for the calculation, so there is a compounding effect (rewards on earned rewards). 

As this function is restricted to `view`, the `handleNewPeriod` function cannot be triggered before applying the calculation. The loop for reward calculation works like this:

* From the `lastClaimed` date of the user until the latest period registered in `rewardPeriods` state, use the stake defined in the struct of `rewardPeriods`.
* Between the latest registered period and the current period, simulate the total stake based on the data in the last reward period. The state is not up to date, but as the `handleNewPeriod` function was not called in the meantime, the state stayed the same since then and can be simulated. If the state was updated (e.g. someone staked, withdrew, updated his weight,...) the `handleNewPeriod` would have been triggered, which is not the case.
* Any period starting from the current period depends on future events which did not happen yet, so is estimated based on the latest data available.

When a user added new tokens to his staking balance in the previous period, it is skipped for the reward calculation. After rewarding the first period, the new stake is added to the total stake used for calculation.

The funcion is also used to calculate the locked tokens this user earned, by multiplying the reward for each period by the `extraRewardsMultiplier` of the same period. If the unlock date is not yet reached, the locked token balance of the user is increased. Once the unlock date is reached, the total locked balance is added to the staking balance and the locked token balance is reset to 0.

In the end, the function returns:

* The earned rewards
* The new locked balance of this staker
* The state of the stakeholder (used in the `handleRewards` function)

### Claiming rewards

The internal `handleRewards` function is responsible for reward claiming. It can only be claimed by wrapper functions inside the contract itself. It first calls the `handleNewPeriod` to make sure the state for past periods is correct. Then it makes use of the `calculateRewards` function above to assign the rewards. The arguments are:

* The `stakeholderAddress` for which to claim the rewards
* The `endPeriod` of the reward calculation. In this function, the period can not exceed the current period. The end period can be defined to limit gas needed to process this function. In the edge case no one updated the reward periods for a long time, the gas cost can theoretically become too high to handle in one transaction. For this reason, the contract allows to split this over multiple transactions, avoiding a crash of the contract because the gas cost exceeds the limit. Normally, this argument is set to the current reward period to claim all rewards. If the end period equals the `lastClaimed` field of the stakeholder, the function reverts. Spending gas on a trivial update is not wanted.
* A boolean `withdraw`, which will send the reward in tokens to the users wallet. If false (which will be the case for all internal calls), the rewards are added to the stakers balance. If wiithdraw is set to true and the stakeholder withdraws his last funds by this action, the stakeholder is deactivated (by resetting the start date and decreasing the `weightCounts` mapping for the stakeholders weight, after which the `maxWeight` for this period is potentially lowered).

If the stakeholder is not active at the moment the function is called, the function returns. If there is no stake whatsoever, the function returns as well. It does not revert, because it is also called by other contract functions, after which calculations should continue.

If the function did not return yet, it calls the `calculateRewards` function. It takes the rewards, locked token reward and new stakeholder stake and writes them to the contract state. Afterwards, it updates the `lastClaimed` function of the user to the `endDate` function argument.

Handle rewards is called by 2 functions:

* `claimRewards`, which always uses the message sender as `stakeholderAddress`. This function will be called by stakeholders who wish to claim their rewards, either directly via a function call or indirectly via an other function in the contract (stake, increaseWeight or requestWithdrawal).

## Withdrawing funds

Funds can leave the contract in 3 ways:

* When a stakeholder withdraws his rewards instead of adding them to the staking balance
* When a stakeholder calls the `requestWithdraw` function to initiate a withdraw and `withdrawFunds` to finalize the withdrawal
* When the contract owner withdraws funds via `withdrawRemainingFunds`

To first option is explained in the [claiming rewards](#claiming-rewards) section. The other two are explained below.

### Stakeholder withdrawals

To withdraw funds as a stakeholder, you have to first call the `requestWithdrawal`. This function takes the `amount` to withdraw, a boolean `instant` and a boolean `claimFirst` as function arguments (more on this later) and initiates a withdrawal. Afterwards, the `withdrawFunds` can be called to finalize the withdrawal. There are 3 options to do so:

* Withdrawing the funds instantly in one transaction by setting the `instant` argument to true. `withdrawFunds` is called automatically at the end of the transaction, so does not need to be triggered manually. Withdrawing instantly comes with a fee for early withdrawal. The fee equals the global variable `earlyWithdrawalFee`, which can be set by the contract owner. 
* Requesting a withdrawal and only withdrawing the funds wit `withdrawFunds` after a cooldown period passed. There is no fee and the `instant` argument needs to be set to false. The global variable `cooldown` can be set by the contract owner as well.
* The hybrid solution by setting `instant` to false and not claiming instantly, but withdrawing with `withdrawFunds` before the cooldown period is over. This requires a fee which linearily decreases when time goes by. The fee starts at the full early withdrawal fee at the moment of withdrawing request (equal to the first option, but in two transactions) and paying no fee once the cooldown period passes (equal to the second option).

If `cooldown` equals 0, all options are the same and `instant` is automatically set to `true`.

### Requesting a withdrawal

Requesting a withdrawal normally updates the previous period and calculates the rewards for the user first. This can be skipped by setting the `claimRewardsFirst` option to false.  Doing so will result in forfaiting the rewards that were not claimed yet. **It should always be set to true, unless the contract is broken and further periods cannot be calculated anymore**. This is a failsafe to always be able to withdraw the stakeholders funds, even when the period or reward calculation somehow breaks.

After claiming all rewards, the amount to withdraw is subtracked from the stakeholder balance in this order:

1. The new stake that has not been staked for a period
2. The staking balance of the owner that has been staked for more than a period

If he requested amount to withdraw is bigger than the sum of the balances above, it is reduced to the sum of the balances. A stakeholder can only withdraw what he owns. The total balance is subtrackted by this amount as well, as it also decreases.

If the stakeholder does not have any funds left anymore, he is deactivated by setting the startdate to 0 and decreasing the `weightCounts` mapping for the stakeholder's weight by 1. `handleDecreasingMaxWeight` if the stakeholder was the only stakeholder with the maximum weight.

The `releaseDate` for the owner is set to the current blocktime increased by the cooldown period. It is used in the calculation for the early withdraw fee as described in the previous section. The `releaseAmount` for the stakeholder is set to the capped amount to withdraw.

If `instant` is st to true, the `withdrawFunds` function is called at the end of the function. Otherwise, the tokens remain in the contract, but will not generate rewards anymore.

### Finalizing withdrawal

If `requestWithrawal` is called with `instant` set to false, the `withdrawFunds` function needs to be triggered manually to extract the tokens from the contract. If the request function was not called first, the release date and release amount of the stakeholder equal 0 and this function reverts.

Afterwards, the function calculates the fee to be paid for early withdrawal as described two sections back. The result might be 0, depending on the timing of the function call, the value of the fee and the cooldown period.

Afterwards, the tokens are transferred from the contract:

* The fee stays in the contract and will be added to the rewards to distribute
* The amount to release minus the fee goes to the stakeholder

When the tokens are transferred, the `releaseDate` and `releaseAmount` are reset for the stakeholder.

### Withdrawing as contract owner

The owner can withdraw funds from the contract as well with `withdrawFundsAsOwner`. This function only takes the amount as argument. However, the owner can only withdraw funds that are:

* Not staked by any user
* No locked rewards to be paid in the future.

This ensures the stakeholders do not need to trust the owner: the owner can never steal the funds of the stakeholders.

When an owner withdraws funds from the contract, it will lower the total reward to be distributed over the remaining periods.
## Events

The contract sends events when certain actions happen. The actions are:

* `ConfigUpdate` sends an event when a setter is called by the owner. It emits which field was updated and what the new value is.
* `Staking` emits which address staked how much
* `Rewarding` sends which stakeholder was rewarded, how much the reward was, how much the locked tokens were received as extra reward and for how many periods the stakeholder was rewarded.
* `InitiateWithdraw` emits which address requested a withdraw and when his cooldown period is over.
* `Active` emits the stakeholder address and if he becomes active (true) or inactive (false)

## ERC20 compatibility

The fields `name`, `symbol` and `decimals` are included to display your staking balance tools expecting the ERC20 interface, e.g. metamask. The function `balanceOf` is implemented as well and will return the sum of:

* total staking balance
* total new stake
* total locked tokens
* total rewards to be claimed

Other ERC20 functions are not included, as the contract is not real token and will not be treated as such.
