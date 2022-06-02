# Staking logic

## Reward calculation

The goal of the contract is to periodically pay out a constant reward amongst the stakeholders. The period is hardcoded and cannot be altered after deployment, the reward per period is linked to the token balance of the contract. Whenever the token balance of the contract rises, the total funds distributed amongst the stakers will rise as well. This allows increasing the rewards when times are good and sharing profits with the community. The complexity of the contract lies in a correct distribution.

Stakeholders will be rewarded for each *full reward period* they staked, so the period in which they stake is not taken into account.

The formula for reward calculation is:
*The reward for each period is the reward per period multiplied by the relative share of the stakeholder in the total weighted staked funds, taking previous rewards into account.*

Let's break this down.

* The *reward per period* is the value to be distributed amongst the shareholders, and as mentioned earlier it is based on the token balance. The more funds sent to the contract, the higher the stake. At the beginning of a period, the reward is set to the reward of the previous period (as it is the best approximation). At the end of each period, a snapshot is taken of the total tokens to be distributed, divided by the remaining periods that need to be rewarded.
* The *share of the stakeholder* is the amount staked, multiplied by the weight of the stakeholder. Stakeholders with a higher weight, will be rewarded more. The *total weighted staked funds* is the sum of all staked amounts, multiplied by the weight of the staker. The *relative* share is the share of the stakeholder, divided by the total weighted staked funds. All relative weighted stakes combined sum to 1, and the rewards of all stakers combined sum to the reward for this period.
* *taking previous rewards into account* refers to the fact that rewards are compounded. Rewards are given on previous earned rewards. If a stakeholder stakes for multiple periods, the reward of the first periods will be added to his balance, and the reward in the second period will be calculated using the increased new balance. Even if the stakeholder did not explicitly claim the rewards, the reward calculation will implicitly adjust the reward calculation when the stakeholder claims at a later point in time. For this to work, the *total weighted staked funds* needs to take all previously earned rewards into account, wether they are already claimed or not.

In pseudocode, the formula for one period becomes:

``` javascript
reward = rewardsPerPeriod * (userStakingBalance * userWeight) / totalWeightedStakingBalance
```

With:

* `rewardsPerPeriod` the rewards to be distributed, equal for each staker
* `userStakingBalance` the staked funds of the stakeholder, *including the rewards of previous periods*. This means stakers do not have to claim their rewards after each period to have optimal return, rewards compound in the calculation.
* `userWeight` the weight of the user. This weight is an integer defaulting to 1.
* `totalWeightedStakingBalance` the total funds in the contract taking the weights of the stakers and all previous rewards that might not have been claimed into account.

Applying the formula for each stakeholder and summing up the results exactly equals the `rewardsPerPeriod` value.
To receive the ENVOY tokens earned, stakeholders must manually claim them from the contract after one or multiple staking periods are over.

## Locked bonus rewards

For each reward claimed, the user receives an additional **bonus reward** which will be locked until a certain **unlock date**. The bonus is the reward multiplied by a multiplier that is set for each period, which can be adjusted by the contract owner. Once the unlock date is reached, the tokens will be added to the stake and they can be withdrawn from the contract. This means that the compounding logic does *not* take the locked tokens into account before the unlock date, but it does once the unlock date is reached. Once the unlocked date is reached, a new period begins with a new unlock date. The period between unlock dates is set at contract deployment and cannot be changed, just like the normal reward period.

## Increasing the off-chain user level

The interest of the stakeholder is dependent on a weight based on the user level, assigned by ENVOY off-chain. The stakeholders have to manually update their level themselves. The steps to level-up are:

* Interact on the platform and earn points
* Once a certain level is used, a signature for a certain level can be requested. This signature will contain the stakeholders address, the level he is at and the staking contract. It will be singed by a private key of Envoy.
* The stakeholder provides the signature in the on-chain function to level up. The smart contract verifies if this signature for the specific input was signed by the Envoy key. If the signature is valid, the stakeholder's interest weight increases. If a malicious signature is used, the transaction will be reverted.

The contract owner can also adjust user weights in batch. For this approach, no signatures are needed. This allows the contract owner to demote stakeholders who earned a higher level in the passed based on off-chain actions, but do not meet these terms anymore. It can also fix an error where a stakeholder got a wrong level (e.g. 100 instead of 10).

## Adjusting stake or increasing weights in between staking periods

When people want to increase the amount staked, increase their user level or withdraw funds, it probably happens in the middle of a staking period. For adjusting the stake, the update is *delayed* and will be applied from the *next* period. If a user increases his stake, the current period will still use the old staked amount for reward calculation. Starting from next period, the new staked amount will be used. This is to avoid misuse of last-minute stakers gaining full rewards.

Updating the user weight will be applied immediately. This is because users who are rewarded with a higher weight deserve the update and the feature cannot be misused.

## Withdrawing funds

When people want to stop staking, they can request a withdrawal for a certain amount. The amount can be only a part of the staking balance and will be capped by the total staking balance. The amount will be reduced from the balance immediately. The funds are not considered for rewards anymore. To retrieve the tokens, there are 2 options:

* Pay a fee for early withdrawal
* Wait until a cooldown period is over to finalize the withdrawal without any additional fees.

Instant withdrawal will result in the paying the full fee, afterward the fee decreases linearly in time until it reaches 0 after the cooldown period is passed. The aim of the measure is to avoid people gaining big rewards and immediately dumping the token afterward. The cooldown period can be set by the contract owner.

There is a function for the owner to withdraw tokens from the contract. This function will be used to withdraw tokens that are accidentally sent to the contract and cannot be retrieved anymore. The function is restricted to withdrawing only tokens that are:

* not staked by a user
* not part of the earned rewards
* not a part of the locked bonus tokens.

## Keeping the contract up-to-date

The contract is designed to keep itself up to date. After each state modification by a user (staking, withdrawing, updating weight,...) the state is updated first before applying the changes. When no changes happen for multiple periods, the update can be delayed. When an update is needed, the previous periods can be updated in batch based on the deterministic data.

 However, as the reward per period is directly linked to the token balance, a snapshot of the current token balance is needed at the end of each period. If the update only happens after multiple periods, the increase in the token amount to reward will be spread over all past periods equally, while the increase might have been lower in the first period and higher in the last period. *on average*, the total rewards distributed are the same, so each stakeholder will receive the correct reward.

 Too keep the contract up to date at all times, we use the Keepers solution of [Chainlink](https://docs.chain.link/docs/chainlink-keepers/introduction/). The solution will check if the contract is up to date, and update if necessary.
