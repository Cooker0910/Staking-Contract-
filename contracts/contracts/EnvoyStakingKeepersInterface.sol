//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./EnvoyStaking.sol";

/**
* Wrapper contract to subscribe an EnvoyStaking contract to the Chainlink Keepers solution
*/
contract EnvoyStakingKeepersInterface{
    EnvoyStaking stakingContract;

    constructor(address stakingContractAddress){
        stakingContract = EnvoyStaking(stakingContractAddress);
    }

    function checkUpkeep(bytes calldata /* checkData */) public view returns (bool upkeepNeeded, bytes memory /* performData */){
        upkeepNeeded = stakingContract.latestRewardPeriod() < stakingContract.currentPeriod();
    }

    function performUpkeep(bytes calldata /* performData*/ ) external{
        stakingContract.handleNewPeriod(stakingContract.currentPeriod());
    }

}