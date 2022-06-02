# Cooker staking contract

## Aim of this repository

This repository contains the source code for the staking contract created for the Cooker token. Users can stake their token to receive a periodic interest reward on their investment. The duration of the reward periods is fixed global variable and cannot be altered. It is the same for all stakeholder. At the end of each period, a reward is distributed between all the shareholders with a stake. The reward will be based on the total funds available in the contract that are not yet distributed. The share they receive depends on following parameters:

* The **token amount** staked by each individual stakeholder
* The **time** staked by the stakeholder, as rewards do compound. Rewards of previous periods are automatically added to the users staking balance.
* The **user weight** or **user level** of the stakeholder, which is determined based on off-chain actions.

For each reward period, a bonus is paid. The bonus will result in additional tokens that are locked until a certain unlock date in the future. Once the unlock date is reached, the tokens can be claimed and added to the stakers balance.

## Deployed contracts

Here, you can find a list with contracts deployed by Cooker:

| Network | Token address | Staking address | Date | Version |
|-|-|-|-|-|
| Mumbai | 0x62e4fBfAd641dEe407f0f9f7e4eBc5Ae14E99d8a | 0xe4F9EB1C469873F33B0c90E387e5ac0D8b7Cc0BB | 11/01/2022 | 0.0.1 |
| Mumbai | 0x62e4fBfAd641dEe407f0f9f7e4eBc5Ae14E99d8a | 0x7EA43F7a9f33CF7F7F041a0E9959B03182C58C5B | 23/01/2022 | 0.0.2 - Variable rewards |
| Polygon | | |

## Documentation references

To learn more about the general staking logic and functionality, we refer to the staking documentation on our [wiki](wiki):

* [Staking logic][stakinglogic]

To get a better understanding of what's going on, we also have an example which might help:

* UNDER CONSTRUCTION - [Example][example]

We have a demo react app in this repository to showcase the functionality of the contract:

* UNDER CONSTRUCTION - [demo][demo]
  
If you are curious about what is going on behind the curtain or want to learn more about the smart contract itself, we have a more technical, white-paperish description to guide you through the code:

* [Contract implementation][contractlogic]

You can check the coverage of our unit tests in the coverage reports:

* [Coverage report][coverage]

If you want to integrate with the contract, the API of the smart contract can be found below:

* [API][api]

[wiki]: https://github.com/cooker0910/Staking-Contract/wiki/home
[api]: https://github.com/cooker0910/Staking-Contract/wiki/API
[contractlogic]: https://github.com/cooker0910/Staking-Contract/wiki/contract-implementation
[example]: https://github.com/cooker0910/Staking-Contract/wiki/Example
[stakinglogic]: https://github.com/cooker0910/Staking-Contract/wiki/Staking-Logic
[demo]: https://github.com/cooker0910/Staking-Contract/wiki/Demo
[coverage]: https://htmlpreview.github.io/?https://github.com/cooker0910/Staking-Contract/blob/master/docs/test_coverage/index.html