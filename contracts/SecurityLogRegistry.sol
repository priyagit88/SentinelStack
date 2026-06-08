// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SecurityLogRegistry {
    address public owner;

    struct SecurityLog {
        string userId;
        string action;
        string riskScore;
        uint256 timestamp;
    }

    // Internal mapping from log index to SecurityLog struct
    mapping(uint256 => SecurityLog) private registry;
    uint256 private logCount;

    // Log emitted event containing logIndex, userId, action, riskScore, and block.timestamp
    event LogEmitted(
        uint256 indexed logIndex,
        string userId,
        string action,
        string riskScore,
        uint256 timestamp
    );

    // Modifier to restrict write transactions to the Next.js backend operator wallet
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Write a forensic security log to the immutable audit trail.
     * @param userId The unique identifier of the user causing the alert.
     * @param action The specific security action or alert category.
     * @param riskScore The computed risk level (e.g. LOW, MEDIUM, HIGH, CRITICAL).
     * @return The sequential index assigned to this log in the ledger.
     */
    function emitLog(
        string memory userId,
        string memory action,
        string memory riskScore
    ) public onlyOwner returns (uint256) {
        uint256 index = logCount;
        registry[index] = SecurityLog({
            userId: userId,
            action: action,
            riskScore: riskScore,
            timestamp: block.timestamp
        });
        logCount++;

        emit LogEmitted(index, userId, action, riskScore, block.timestamp);
        return index;
    }

    /**
     * @notice Get the absolute number of untampered on-chain records.
     */
    function getLogCount() public view returns (uint256) {
        return logCount;
    }

    /**
     * @notice Fetch a specific log record by its index.
     */
    function getLog(uint256 index) public view returns (
        string memory userId,
        string memory action,
        string memory riskScore,
        uint256 timestamp
    ) {
        require(index < logCount, "Index out of bounds");
        SecurityLog memory log = registry[index];
        return (log.userId, log.action, log.riskScore, log.timestamp);
    }
}
