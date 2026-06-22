// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract SentinelAccess is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ANALYST_ROLE = keccak256("ANALYST_ROLE");

    mapping(address => uint256) public lastLogin;

    event AdminLogin(address indexed admin, uint256 timestamp);

    constructor(address[] memory initialAdmins) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        for (uint i = 0; i < initialAdmins.length; i++) {
            _grantRole(ADMIN_ROLE, initialAdmins[i]);
        }
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    function isAnalyst(address account) external view returns (bool) {
        return hasRole(ANALYST_ROLE, account);
    }

    function recordLogin() external {
        require(hasRole(ADMIN_ROLE, msg.sender) || hasRole(ANALYST_ROLE, msg.sender), "Unauthorized");
        lastLogin[msg.sender] = block.timestamp;
        emit AdminLogin(msg.sender, block.timestamp);
    }

    function addAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ADMIN_ROLE, account);
    }

    function removeAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ADMIN_ROLE, account);
    }
}
