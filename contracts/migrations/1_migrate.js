
require('dotenv').config({path: '../.env'})
const EnvoyStaking = artifacts.require("EnvoyStaking");
const EnvoyStakingERC20 = artifacts.require("EnvoyStakingERC20");
const EnvoyStakingKeepersInterface = artifacts.require("EnvoyStakingKeepersInterface");
const TestToken = artifacts.require("TestToken");

module.exports = async function (deployer, network, accounts) {
  
  const signerKey = network === 'mainnet' ? process.env.PRODUCTION_SIGNATURE_KEY : process.env.DEVELOPMENT_SIGNATURE_KEY
  const signatureAddress = web3.eth.accounts.privateKeyToAccount(signerKey).address

  // Deploy a test token no token address is defined.
  // Only deploy on dev or test nets.
  var tokenAddress = process.env[network.toUpperCase()+'_TOKEN_ADDRESS']

  if((tokenAddress === '' || tokenAddress == undefined) && network != 'mainnet'){
    await deployer.deploy(TestToken)
    var token = await TestToken.deployed()
    tokenAddress = token.address
  }
  await deployer.deploy(EnvoyStaking,
                        maxNumberOfPeriods_ = web3.utils.toBN(43800),//(1825),
                        rewardPeriodDuration_ = web3.utils.toBN(600),//(86400),
                        periodsForExtraReward = web3.utils.toBN(120),
                        extraRewardMulitplier_ = web3.utils.toBN(10**6),
                        cooldown_ = web3.utils.toBN(3600),//(86400 * 10),
                        // rewardPerPeriod_ = web3.utils.toBN('1000000000000'),
                        earlyWithdrawalFee_ = web3.utils.toBN(10**7),
                        // wallet_ = accounts[0],
                        signatureAddress,
                        tokenAddress);    

  const stakingContract = await EnvoyStaking.deployed()
  await deployer.deploy(EnvoyStakingERC20, stakingContract.address)
  await deployer.deploy(EnvoyStakingKeepersInterface, stakingContract.address)

  if(network != 'mainnet'){
    var token = await TestToken.at(tokenAddress)
    await token.claim(stakingContract.address, '87600000000000000000000000')
  }
};