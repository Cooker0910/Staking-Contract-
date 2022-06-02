An diagram with an example of the staking contract can be found in this link
[link](https://viewer.diagrams.net/?tags=%7B%7D&highlight=0000ff&edit=_blank&layers=1&nav=1&title=Staking#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fenvoynetwork%2Fstaking-contract-v2%2Fmain%2Fdocs%2FStaking). It is advised to read the documentation with the diagram as guideline. In the example, there are 4 stakers. In reality, there are probably more. The reward per period is set to 30 for example purpose.

# Period 1

In the first period, the reward per period is set to 30. 3 stakeholders invest for 50, 30 and 20 tokens. In this period, no rewards are distributed as nothing was staked the period before. Stakeholders will start gaining once they staked for a **full** reward period.

# Period 2

The first 3 stakers start their first full rewarding period. From this period and onwards they will start gaining rewards. A forth stakers joins the system for 50 tokens. This staker will start getting rewards for period 3, when staking for a full period.

# Period 3

Stakeholder 1 updates his weight from 1 to 2. The update is done instantly, from this period and onwards rewards will be calculated with weight 2. This means that his share of the total rewards doubles. His rewards with the old weight are calculated for the previous periods.

In period 1, the staker did not earn anything as nothing was staked. In period 2, the staker had 50 from a total pool of 100 tokens staked with a reward per period of 30, so the staker receives 15 tokens. Period 3 is ongoing, so no rewards are rewarded yet. The next reward calculation in later periods will start from period 3 for stakeholder 1.

# Period 4

Stakeholder 2 stakes another 50. As with each user update, the rewards using previous state is rewarded first before updating the values.

* For period 1, the staker is not rewarded as he did not stake the full period.
* For period 2, the staker owned 30 out of 100 shares with a reward of 30 per period, so the staker is rewarded 9 tokens.
* For period 3, the staker owned 39 tokens (the initial 30 and 9 from period 2) out of 230 shares (50 initial of stakeholder 1, 15 claimed by stakeholder 1. These need to be multiplied with weight 2, resulting in 130. We need to add his own 30, 20 of stakeholder 3 and 50 of stakeholder 4) 15 out of 30 tokens that are reserved to be paid as reward also need to be added to the total stake, because they are implicitly part of the stake. The final share is 39 tokens out of 180. Multiplied with 30 as reward per period, we get a reward of 4,77 for stakeholder 2 in this period.

Combined, stakeholder 2 receives 13.77 tokens.

The update of the new stake is not done instantly. The rewards for this period will be calculated using the *old* stake. From period 5 and onwards, the new stake will be used. Stakeholders need to have the stake for a full period before it is rewarded.
