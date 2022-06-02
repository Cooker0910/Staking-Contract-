
//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./EnvoyStaking.sol";

/**
 * Partial ERC20 compatible contract to fetch funds staked in an EnvoyStaking contract
 */
contract EnvoyStakingERC20 {

    string public name = "Staked ENV"; 
    string public symbol = "sENV";
    uint public decimals = 18;

    EnvoyStaking stakingContract;

    constructor(address stakingContractAddress){
        stakingContract = EnvoyStaking(stakingContractAddress);
    }

    /**
     * Returns the tokens staked, the rewards earned and locked tokens as balance for a stakeholder.
     * Used in applications expecting the ERC20 interface, e.g. Metamask
     * @param stakeholderAddress the address to return the balance for
     * @return balance the sum of total stakingbalance, reward and locked tokens
     */
    function balanceOf(address stakeholderAddress) public view returns (uint256 balance){
            (uint reward,, EnvoyStaking.StakeHolder memory stakeholder) = stakingContract.calculateRewards(stakeholderAddress,
                                                         stakingContract.currentPeriod());

            balance = stakeholder.stakingBalance
                + stakeholder.newStake
                + reward
                + stakeholder.lockedRewards; 

    }

    /**
     * Returns the total value locked in the staking contract
     * @return totale tokens locked in the stakingcontract
     */
    function totalSupply() public view returns(uint256){
        return stakingContract.stakingToken().balanceOf(address(stakingContract));
    }
}
