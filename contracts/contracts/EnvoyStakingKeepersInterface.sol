//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./CookerStaking.sol";

/**
* Wrapper contract to subscribe an CookerStaking contract to the Chainlink Keepers solution
*/
contract CookerStakingKeepersInterface{
    CookerStaking stakingContract;

    constructor(address stakingContractAddress){
        stakingContract = CookerStaking(stakingContractAddress);
    }

    function checkUpkeep(bytes calldata /* checkData */) public view returns (bool upkeepNeeded, bytes memory /* performData */){
        upkeepNeeded = stakingContract.latestRewardPeriod() < stakingContract.currentPeriod();
    }

    function performUpkeep(bytes calldata /* performData*/ ) external{
        stakingContract.handleNewPeriod(stakingContract.currentPeriod());
    }

}