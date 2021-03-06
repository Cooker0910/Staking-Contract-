// TODO: Fix implementation

// const CookerStaking = artifacts.require("CookerStaking");
// const TestToken = artifacts.require("TestToken");

// const truffleAssert = require('truffle-assertions');
// const truffleHelpers = require('openzeppelin-test-helpers');

// const sigs = require('../utils/signatures.js');
// const assert = require('assert');
// const signerKey = sigs.signerKey
// const signatureAddress = sigs.signatureAddress
// const getSignature = sigs.getSignature

// /*
// Test different situations of rewards claiming
//  - Claiming and adding to staking balance with compounded interest
//  - Claiming and withdrawing rewards
//  - Claiming in between compounding periods
//  - Claiming with large stakes over long periods
//  - Claiming with weighted stakeholders
// */

// contract("Rewarding", function(accounts) {
    
//     // Current time
//     var startTime
//     var currentTime
    
//     // User addresses
//     const ownerAddress = accounts[0];
//     const staker1 = accounts[1];
//     const staker2 = accounts[2];
//     const staker3 = accounts[3];
//     const staker4 = accounts[4];


//     // Contracts to use
//     var contract
//     var token
       
//     // Store initial contract values
//     var contractBalance
//     var rewardPeriodDuration
    
//     before(async function() {
//         // Set start time        
//         startTime = await truffleHelpers.time.latest();

//         // Make sure contracts are deployed
//         token = await TestToken.new();
//         contract = await CookerStaking.new(maxNumberOfPeriods_ = web3.utils.toBN(1095),
//             rewardPeriodDuration_ = web3.utils.toBN(86400),
//             periodsForExtraReward_ = 20, // 20 for test purpose
//             extraRewardMultiplier_ = 10**6,
//             cooldown_ = web3.utils.toBN(86400 * 7),
//             // rewardPerPeriod_ = web3.utils.toBN('135000000000000000000000'),
//             earlyWithdrawalFee_ = web3.utils.toBN(10**7),
//             // // wallet_ = accounts[0],
//             signatureAddress, token.address);
        
//         // Make sure the contract and accounts have funds
//         for(let account in accounts){
//             await token.claim(accounts[account], web3.utils.toWei('100000'))
//             await token.approve(contract.address, web3.utils.toWei('100000'), {from: accounts[account]})
//         }
//         await token.claim(contract.address, web3.utils.toWei('1000000'))
        
//         // Store initial contract values
//         rewardPeriodDuration = await contract.rewardPeriodDuration.call()                
//         contractBalance = await token.balanceOf(contract.address)

//     }),

//     it("Period 1: First 3 stakers stake, set reward per period to 30000", async function() {
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '0')
        
//         // Update reward per period
//         await contract.updateRewardPerPeriod(web3.utils.toWei('30000'), {from: ownerAddress})
        
//         // Let first 3 stakers stake 50, 30 and 20
//         await contract.stake(web3.utils.toWei('50000'), {from: staker1})
//         await contract.stake(web3.utils.toWei('30000'), {from: staker2})
//         await contract.stake(web3.utils.toWei('20000'), {from: staker3})
        
//         // Verify updates

//         // Period should not have changed
//         assert.equal(latestRewardPeriod.toString(), '0')

//         // Check if the tokenbalance was updated correctly
//         assert.equal((await token.balanceOf(staker1)).toString(), web3.utils.toWei('50000'))
//         assert.equal((await token.balanceOf(staker2)).toString(), web3.utils.toWei('70000'))
//         assert.equal((await token.balanceOf(staker3)).toString(), web3.utils.toWei('80000'))
//         assert.equal((await token.balanceOf(contract.address)).toString(), web3.utils.toWei('1100000'))

//         // Check if the stakeholders received funds
//         assert.equal((await contract.stakeholders.call(staker1)).newStake.toString(), web3.utils.toWei('50000'))
//         assert.equal((await contract.stakeholders.call(staker2)).newStake.toString(), web3.utils.toWei('30000'))
//         assert.equal((await contract.stakeholders.call(staker3)).newStake.toString(), web3.utils.toWei('20000'))

//         // Check if total stake was updated correctly in the contract
//         var totalNewStake = (await contract.totalNewStake.call(latestRewardPeriod,0))
//         var totalNewWeightedStake = (await contract.totalNewStake.call(latestRewardPeriod,1))
//         assert.equal(totalNewStake.toString(), web3.utils.toWei('100000'))
//         assert.equal(totalNewWeightedStake.toString(), web3.utils.toWei('100000'))     
//     }),
        
//     it("Period 2: Forth staker stakes", async function() {

//         // Move to period 2
//         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        
//         // We are in period 2, but no update of the latest reward period was triggered yet
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '0')
//         assert.equal(await contract.currentPeriod.call(), 1, "The period was not updated correctly")

//         // Staker 4 stakes
//         await contract.stake(web3.utils.toWei('50000'), {from: staker4})
//         assert.equal((await token.balanceOf(staker4)).toString(), web3.utils.toWei('50000'))

//         // We are in the second period, after staking the reward period should be updated
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '1')

//         // Check if total balances of period 2 are updated correctly
//         var totalNewStake = (await contract.totalNewStakes.call(latestRewardPeriod,0))
//         var totalNewWeightedStake = (await contract.totalNewStake.call(latestRewardPeriod,1))
//         assert.equal(totalNewStake.toString(), web3.utils.toWei('50000'))
        
//         // Check if the updates of period 1 were done correctly
//         var totalStakingBalance = (await contract.totalStakingBalance.call(latestRewardPeriod,0))
//         var totalWeightedStakingBalance = (await contract.totalStakingBalance.call(latestRewardPeriod,1))
//         assert.equal(totalStakingBalance.toString(), web3.utils.toWei('100000'))
//         assert.equal(totalWeightedStakingBalance.toString(), web3.utils.toWei('100000'))


//         // assert.equal((await contract.stakeholders.call(staker1)).newStake.toString(), web3.utils.toWei('0'))
//         // assert.equal((await contract.stakeholders.call(staker2)).newStake.toString(), web3.utils.toWei('0'))
//         // assert.equal((await contract.stakeholders.call(staker3)).newStake.toString(), web3.utils.toWei('0'))
        
//         // assert.equal((await contract.stakeholders.call(staker1)).stakingBalance.toString(), web3.utils.toWei('50'))
//         // assert.equal((await contract.stakeholders.call(staker2)).stakingBalance.toString(), web3.utils.toWei('30'))
//         // assert.equal((await contract.stakeholders.call(staker3)).stakingBalance.toString(), web3.utils.toWei('20'))
//         console.log('Staking rewards after 5 periods before handeling new period:')
//         console.log((await contract.latestRewardPeriod.call()).toString())
//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))
//         console.log('staker1: ', web3.utils.fromWei(web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)))
//         console.log('staker2: ', web3.utils.fromWei(web3.utils.toBN(calculation2.stakeholder.stakingBalance).add(calculation2.reward)))
//         console.log('staker3: ', web3.utils.fromWei(web3.utils.toBN(calculation3.stakeholder.stakingBalance).add(calculation3.reward)))
//         console.log('staker4: ', web3.utils.fromWei(web3.utils.toBN(calculation4.stakeholder.stakingBalance).add(calculation4.reward)))

//     }),
//     it("Period 3: First staker updates weight", async function() {
        
//         // Move to period 3
//         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        
//         // We are in period 3, but no update of the latest reward period was triggered yet
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '1')
//         assert.equal(await contract.currentPeriod.call(), 2, "The period was not updated correctly")

//         // Get signature for staker 1 to get stake 1
//         var firstSignature = getSignature(contract, staker1, 1).signature
//         // Staker should be able to instantly update the weigth with the correct sig
//         await contract.increaseWeight(1, firstSignature, {from: staker1})

//         // Check if everything was updated correctly
//         assert.equal('1', (await contract.stakeholders.call(staker1)).weight.toString())
//         assert.equal('1', (await contract.maxWeight.call()).toString())
//         assert.equal('2', (await contract.stakeholders.call(staker1)).lastClaimed.toString())

//         // Check if the updates of period 2 and 3 were done correctly
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '2')
//         var totalStakingBalance = (await contract.totalStakingBalance.call(latestRewardPeriod,0))
//         var totalWeightedStakingBalance = (await contract.totalStakingBalance.call(latestRewardPeriod,1))
//         // Balance composed of:
//         // + 100 from initial stake of stakers 1, 2 and 3
//         // + 50 from staker 4's new balance
//         // + 30 from rewards from period 2
//         assert.equal(totalStakingBalance.toString(), web3.utils.toWei('180000'))
//         // Weighted balance composed of:
//         // + 100 from initial stake of stakers 1, 2 and 3
//         // + 50 from staker 4's new balance
//         // + 30 from rewards from period 2
//         // + 65 from the weight increase of staker 1
//         assert.equal(totalWeightedStakingBalance.toString(), web3.utils.toWei('245000'))
//         console.log('Staking rewards after 5 periods before handeling new period:')
//         console.log((await contract.latestRewardPeriod.call()).toString())
//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))
//         console.log('staker1: ', web3.utils.fromWei(web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)))
//         console.log('staker2: ', web3.utils.fromWei(web3.utils.toBN(calculation2.stakeholder.stakingBalance).add(calculation2.reward)))
//         console.log('staker3: ', web3.utils.fromWei(web3.utils.toBN(calculation3.stakeholder.stakingBalance).add(calculation3.reward)))
//         console.log('staker4: ', web3.utils.fromWei(web3.utils.toBN(calculation4.stakeholder.stakingBalance).add(calculation4.reward)))

//     }),
//     it("Period 4: Second staker restakes 50", async function() {
        
//         // Move to period 4
//         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        
//         // We are in period 4, but no update of the latest reward period was triggered yet
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '2')
//         assert.equal(await contract.currentPeriod.call(), 3, "The period was not updated correctly")

//         await contract.stake(web3.utils.toWei('50000'), {from: staker2})

//         // Check if the updates of period 3 and 4 were done correctly
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()
//         assert.equal(latestRewardPeriod.toString(), '3')
//         var totalStakingBalance = (await contract.totalStakingBalance.call(latestRewardPeriod,0))
//         var totalWeightedStakingBalance = (await contract.totalStakingBalance.call(latestRewardPeriod,1))

//         // Balance composed of:
//         // + 180 from previous step
//         // + 30 rewards from period 3
//         // SLIGHT ROUNDING ERROR
//         assert.equal(totalStakingBalance.toString(), '209999999999999999999999')
//         // Weighted balance composed of:
//         // + 230 from previous step
//         // + 13.77 from staker 2 claiming rewards of period 1 and 2
//         assert.equal(totalWeightedStakingBalance.toString(), '290918367346938775510203')

//         // *** Check reward calculation ***
//         // Sum of rewards and balance of all stakers should equal to 210, which is the sum of:
//         // - manual staked balance (150, 50 staked in this period does not count yet)
//         // - the rewards from periods in which rewards were awarded (period 2 and 3, 60 in total)

//         // Check if balance of stakers equals total staking balance
//         var sumOfStakes = (await contract.stakeholders.call(staker1)).stakingBalance
//             .add((await contract.stakeholders.call(staker2)).stakingBalance)
//             .add((await contract.stakeholders.call(staker3)).newStake) // Did not claim, staking balance not updated yet
//             .add((await contract.stakeholders.call(staker4)).newStake) // Did not claim, staking balance not updated yet

//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))

//         var sumOfRewards = calculation1.reward
//             .add(calculation2.reward)
//             .add(calculation3.reward)
//             .add(calculation4.reward)

//         var sumOfStakesAfterRewards = web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)
//             .add(web3.utils.toBN(calculation2.stakeholder.stakingBalance)).add(calculation2.reward)
//             .add(web3.utils.toBN(calculation3.stakeholder.stakingBalance)).add(calculation3.reward)
//             .add(web3.utils.toBN(calculation4.stakeholder.stakingBalance)).add(calculation4.reward)

//         // Slight loss in accuracy due to rounding
//         assert.equal('209999999999999999999998', sumOfStakes.add(sumOfRewards).toString())
//         assert.equal('209999999999999999999998', sumOfStakesAfterRewards.toString())

//         console.log('Staking rewards after 4 periods:')
//         console.log('staker1: ', web3.utils.fromWei(web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)))
//         console.log('staker2: ', web3.utils.fromWei(web3.utils.toBN(calculation2.stakeholder.stakingBalance).add(calculation2.reward)))
//         console.log('staker3: ', web3.utils.fromWei(web3.utils.toBN(calculation3.stakeholder.stakingBalance).add(calculation3.reward)))
//         console.log('staker4: ', web3.utils.fromWei(web3.utils.toBN(calculation4.stakeholder.stakingBalance).add(calculation4.reward)))
//     }),
//     it('Period 5: Third stakers initiates withdrawal', async function() {
//         // Move to period 5
//         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        
//         var sumOfStakesAfterRewards = web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)
//             .add(web3.utils.toBN(calculation2.stakeholder.stakingBalance)).add(calculation2.reward)
//             .add(web3.utils.toBN(calculation3.stakeholder.stakingBalance)).add(calculation3.reward)
//             .add(web3.utils.toBN(calculation4.stakeholder.stakingBalance)).add(calculation4.reward)
        
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()        

//         console.log(' tqwsb, twsb, tsb, rc, ntqwsb, ntwsb, ntsb')
//         for(var i=0;i<=(await contract.latestRewardPeriod.call()).toNumber();i++){
//             c = await contract.rewardPeriods.call(i.toString())
//             console.log(i, 
//                 // web3.utils.fromWei(await contract.totalStakingBalance(i,2,false)),
//                 web3.utils.fromWei(await contract.totalStakingBalance(i,1)),
//                 web3.utils.fromWei(await contract.totalStakingBalance(i,0)),
//                 // web3.utils.fromWei(await contract.rewards(i,1)), 
//                 web3.utils.fromWei(await contract.totalNewStake(1)),
//                 web3.utils.fromWei(await contract.totalNewStake(0)))
//         }

//         console.log('Staking rewards after 5 periods before handeling new period:')
//         console.log((await contract.latestRewardPeriod.call()).toString())
//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))
//         console.log('staker1: ', web3.utils.fromWei(web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)))
//         console.log('staker2: ', web3.utils.fromWei(web3.utils.toBN(calculation2.stakeholder.stakingBalance).add(calculation2.reward)))
//         console.log('staker3: ', web3.utils.fromWei(web3.utils.toBN(calculation3.stakeholder.stakingBalance).add(calculation3.reward)))
//         console.log('staker4: ', web3.utils.fromWei(web3.utils.toBN(calculation4.stakeholder.stakingBalance).add(calculation4.reward)))
//         // 
//         // Amount to withdraw calculated with:
//         // calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         var amountToWithdraw = web3.utils.toBN('32193143830664500103793')

//         // Requesting to withdrawl more than stake + rewards
//         // The request is not instant, so the `withdraw function needs to be triggered manually` 
//         console.log('Staking rewards after 5 periods before handeling after period:')
//         await contract.handleNewPeriod(await contract.currentPeriod.call())
//         console.log((await contract.latestRewardPeriod.call()).toString())
//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))
//         console.log('staker1: ', web3.utils.fromWei(web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)))
//         console.log('staker2: ', web3.utils.fromWei(web3.utils.toBN(calculation2.stakeholder.stakingBalance).add(calculation2.reward)))
//         console.log('staker3: ', web3.utils.fromWei(web3.utils.toBN(calculation3.stakeholder.stakingBalance).add(calculation3.reward)))
//         console.log('staker4: ', web3.utils.fromWei(web3.utils.toBN(calculation4.stakeholder.stakingBalance).add(calculation4.reward)))
//         await contract.requestWithdrawal(web3.utils.toWei('50000'), false, true, {from: staker3})


//         assert.equal((await contract.stakeholders.call(staker3)).stakingBalance.toString(), '0')
//         assert.equal((await contract.stakeholders.call(staker3)).releaseAmount.toString(), amountToWithdraw.toString())
        
//         // *** Check totals  ***
//         // Sum of rewards and balance of all stakers should equal to 290, which is the sum of:
//         // - manual staked balance (200)
//         // - the rewards from periods in which rewards were awarded (period 2,3 and 4, 90 in total)
//         // - minus the 31.847743246676263866 withdrawn by staker 3
//         var latestRewardPeriod = await contract.latestRewardPeriod.call()        
//         assert.equal(latestRewardPeriod.toString(), '4')


//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))

//         sumOfStakesAfterRewards = web3.utils.toBN(calculation1.stakeholder.stakingBalance).add(calculation1.reward)
//         .add(web3.utils.toBN(calculation2.stakeholder.stakingBalance)).add(calculation2.reward)
//         .add(web3.utils.toBN(calculation3.stakeholder.stakingBalance)).add(calculation3.reward)
//         .add(web3.utils.toBN(calculation4.stakeholder.stakingBalance)).add(calculation4.reward)

//         // Slight loss in accuracy due to rounding
//         assert.equal(web3.utils.toBN('289999999999999999999996').sub(amountToWithdraw).toString(), sumOfStakesAfterRewards.toString())

//     }),

//     it('Period 6: Third stakers finalizes withdrawal', async function() {
//         // Move to period 6
//         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        
//         // Finalize the withdrawal
//         await contract.requestWithdrawal(web3.utils.toWei('50000'), false, true, {from: staker3})
    
        
//     }),
    
//     it('Period 20 periods pass and user 4 claims rewards the locked rewards', async function() {
//         // Move to period 20
//         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));

//         await contract.claimRewards.call(await contract.currentPeriod.call(), true, {from: staker1})


//         calculation1 = (await contract.calculateRewards.call(staker1, (await contract.currentPeriod.call())))
//         calculation2 = (await contract.calculateRewards.call(staker2, (await contract.currentPeriod.call())))
//         calculation3 = (await contract.calculateRewards.call(staker3, (await contract.currentPeriod.call())))
//         calculation4 = (await contract.calculateRewards.call(staker4, (await contract.currentPeriod.call())))

        

//     })


// })