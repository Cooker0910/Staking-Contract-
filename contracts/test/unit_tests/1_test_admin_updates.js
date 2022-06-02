const CookerStaking = artifacts.require("CookerStaking");
const TestToken = artifacts.require("TestToken");

const truffleAssert = require('truffle-assertions');
const truffleHelpers = require('openzeppelin-test-helpers');

const sigs = require('../utils/signatures.js')
const signatureAddress = sigs.signatureAddress

/** 
 * Test all owner setters.
 * - Non-owner calls revert
 * - Owner calls update correctly
 * - Additional logic is respected
 */
contract("Update globals as admin", function(accounts) {
    
    // User addresses
    const ownerAddress = accounts[0];
    const nonOwnerAddress = accounts[1];
    // Contracts to use
    var token
    var contract;

    beforeEach(async function() {
        // Make sure contracts are deployed
        token = await TestToken.new();
        contract = await CookerStaking.new(maxNumberOfPeriods_ = web3.utils.toBN(1095),
            rewardPeriodDuration_ = web3.utils.toBN(86400),
            periodsForExtraReward_ = 182, // 20 for test purpose
            extraRewardMultiplier_ = 10**6,
            cooldown_ = web3.utils.toBN(86400 * 7),
            // rewardPerPeriod_ = web3.utils.toBN('135000000000000000000000'),
            earlyWithdrawalFee_ = web3.utils.toBN(10**7),
            // wallet_ = accounts[0],
            signatureAddress, token.address);
        
        var totalInitialRewards = web3.utils.toBN('135000000000000000000000').mul((await contract.maxNumberOfPeriods.call())).muln(2)
        await token.claim(contract.address, totalInitialRewards)
        }),
    
    it("Update signature address", async function() {
        await truffleAssert.reverts(contract.updateSignatureAddress(signatureAddress, {from: nonOwnerAddress}))
        await contract.updateSignatureAddress(signatureAddress, {from: ownerAddress})
        assert.equal(signatureAddress.toString(), (await contract.signatureAddress.call()).toString())
    }),

    it("Update cooldown period", async function() {
        var newPeriod = '86400' // 1 day
        await truffleAssert.reverts(contract.updateCoolDownPeriod(newPeriod, {from: nonOwnerAddress}))
        await contract.updateCoolDownPeriod(newPeriod, {from: ownerAddress})
        assert.equal(newPeriod, (await contract.cooldown.call()).toString())
    }),
    it("Update max number of periods", async function() {
        var newPeriod = '2000' // 1 day
        await truffleAssert.reverts(contract.updateMaxNumberOfPeriods(newPeriod, {from: nonOwnerAddress}))
        await contract.updateMaxNumberOfPeriods(newPeriod, {from: ownerAddress})
        assert.equal(newPeriod, (await contract.maxNumberOfPeriods.call()).toString())
    }),
    it("Update early withdrawal fee", async function() {
        var newFee = web3.utils.toBN(15**7)
        await truffleAssert.reverts(contract.updateEarlyWithdrawalFee(newFee, {from: nonOwnerAddress}))
        await contract.updateEarlyWithdrawalFee(newFee, {from: ownerAddress})
        assert.equal(newFee, (await contract.earlyWithdrawalFee.call()).toString())
    }),
    // it("Update wallet", async function() {
    //     var wallet = accounts[0]
    //     await truffleAssert.reverts(contract.updateWallet(wallet, {from: nonOwnerAddress}))
    //     await contract.updateWallet(wallet, {from: ownerAddress})
    //     assert.equal(wallet, (await contract.wallet.call()).toString())
    // }),
    // it("Update rewards per period", async function() {
    //     // Update reward for current period
    //     var newReward = web3.utils.toBN(12345 * 10**10)
    //     var latestRewardPeriod = await contract.latestRewardPeriod.call()
    //     await truffleAssert.reverts(contract.updateRewardPerPeriod(newReward, {from: nonOwnerAddress}))
    //     await contract.updateRewardPerPeriod(newReward, {from: ownerAddress})
    //     assert.equal(newReward.toString(), (await contract.rewardPeriods.call(latestRewardPeriod)).rewardPerPeriod.toString())
    
    //     // Update in the same period, check it is overwriten
    //     var secondNewReward = web3.utils.toBN(54321 * 10**10)
    //     await contract.updateRewardPerPeriod(secondNewReward, {from: ownerAddress})
    //     assert.equal(secondNewReward.toString(), (await contract.rewardPeriods.call(latestRewardPeriod)).rewardPerPeriod.toString())
        
    //     // Update in a different period, check previous period did not change but current did
    //     let periodDuration = await contract.rewardPeriodDuration.call()
    //     await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(periodDuration));
        
    //     var thirdNewReward = web3.utils.toBN(6789 * 10**10)
    //     await contract.updateRewardPerPeriod(thirdNewReward, {from: ownerAddress})
    //     var newLatestRewardPeriod = await contract.latestRewardPeriod.call()
    //     assert.equal(secondNewReward.toString(), (await contract.rewardPeriods.call(latestRewardPeriod)).rewardPerPeriod.toString())
    //     assert.equal(thirdNewReward.toString(), (await contract.rewardPeriods.call(newLatestRewardPeriod)).rewardPerPeriod.toString())

    // }),
    it("Update extra reward multiplier per period", async function() {
        // Update reward for current period
        var newReward = web3.utils.toBN(12345 * 10**10)
        var latestRewardPeriod = await contract.latestRewardPeriod.call()
        await truffleAssert.reverts(contract.updateExtraRewardMultiplier(newReward, {from: nonOwnerAddress}))
        await contract.updateExtraRewardMultiplier(newReward, {from: ownerAddress})
        assert.equal(newReward.toString(), (await contract.rewardPeriods.call(latestRewardPeriod)).extraRewardMultiplier.toString())
    
        // Update in the same period, check it is overwriten
        var secondNewReward = web3.utils.toBN(54321 * 10**10)
        await contract.updateExtraRewardMultiplier(secondNewReward, {from: ownerAddress})
        assert.equal(secondNewReward.toString(), (await contract.rewardPeriods.call(latestRewardPeriod)).extraRewardMultiplier.toString())
        
        // Update in a different period, check previous period did not change but current did
        let periodDuration = await contract.rewardPeriodDuration.call()
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(periodDuration));
        
        var thirdNewReward = web3.utils.toBN(6789 * 10**10)
        await contract.updateExtraRewardMultiplier(thirdNewReward, {from: ownerAddress})
        var newLatestRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal(secondNewReward.toString(), (await contract.rewardPeriods.call(latestRewardPeriod)).extraRewardMultiplier.toString())
        assert.equal(thirdNewReward.toString(), (await contract.rewardPeriods.call(newLatestRewardPeriod)).extraRewardMultiplier.toString())

    })

})