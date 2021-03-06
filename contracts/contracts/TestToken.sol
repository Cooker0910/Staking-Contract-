//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20{
    constructor() ERC20('TestToken', 'TestToken'){}

    function claim(address claimer, uint amount) public{
        _mint(claimer, amount);
    }
}