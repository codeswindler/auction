<?php
/**
 * Simulator Storage - Display-only, no database writes
 * Used for USSD simulator to show menu flow without affecting real data
 */

class SimulatorStorage {
    private $sessions = []; // In-memory session storage
    private $mockUser = null;
    private $pdo = null;
    
    public function __construct($pdo = null) {
        $this->pdo = $pdo;
        // Create a mock user for simulator
        $this->mockUser = [
            'id' => 999999,
            'phone_number' => '254700000000',
            'id_number' => '12345678',
            'balance' => '5000',
            'loan_limit' => '25100',
            'has_active_loan' => 0
        ];
    }
    
    // Session methods - use in-memory storage
    public function getOrCreateSession($sessionId, $phoneNumber, $ussdCode) {
        if (!isset($this->sessions[$sessionId])) {
            $this->sessions[$sessionId] = [
                'session_id' => $sessionId,
                'phone_number' => $phoneNumber,
                'ussd_code' => $ussdCode,
                'input_history' => '',
                'current_menu' => 'main',
                'last_interaction' => date('Y-m-d H:i:s')
            ];
        }
        return $this->sessions[$sessionId];
    }
    
    public function updateSession($sessionId, $currentMenu, $inputHistory) {
        if (isset($this->sessions[$sessionId])) {
            $this->sessions[$sessionId]['current_menu'] = $currentMenu;
            $this->sessions[$sessionId]['input_history'] = $inputHistory;
            $this->sessions[$sessionId]['last_interaction'] = date('Y-m-d H:i:s');
        }
        return $this->getOrCreateSession($sessionId, '', '');
    }
    
    public function getSession($sessionId) {
        return $this->sessions[$sessionId] ?? null;
    }
    
    // User methods - return mock user, no database writes
    public function getUserByPhoneNumber($phoneNumber) {
        // Return mock user with the requested phone number
        $user = $this->mockUser;
        $user['phone_number'] = $phoneNumber;
        return $user;
    }
    
    public function createUser($data) {
        // Don't create in database, just return mock user
        $user = $this->mockUser;
        $user['phone_number'] = $data['phoneNumber'] ?? '254700000000';
        return $user;
    }
    
    public function getUserById($id) {
        return $this->mockUser;
    }
    
    public function updateUserBalance($id, $balance) {
        // Update mock user balance for display only
        $this->mockUser['balance'] = $balance;
        return $this->mockUser;
    }
    
    public function updateUserLoanLimit($id, $limit) {
        // Update mock user loan limit for display only
        $this->mockUser['loan_limit'] = $limit;
        return $this->mockUser;
    }
    
    public function setLoanStatus($id, $hasActiveLoan) {
        // Update mock user loan status for display only
        $this->mockUser['has_active_loan'] = (bool)$hasActiveLoan ? 1 : 0;
        return $this->mockUser;
    }
    
    // Additional methods that might be called
    public function getTransactionsByUserId($userId) {
        return [];
    }
    
    public function updateTransactionStatus($id, $status) {
        // No-op for simulator
        return true;
    }
    
    public function updateTransactionPaymentStatus($id, $paymentStatus, $mpesaReceipt = null) {
        // No-op for simulator
        return true;
    }
    
    // Transaction methods - no database writes, just return success
    public function createTransaction($data) {
        // Don't create in database, just return a fake ID
        return 999999;
    }
    
    public function createFeeTransaction($userId, $amount, $reference, $parentTransactionId, $feeType = 'fee') {
        // Don't create in database, just return a fake ID
        return 999999;
    }
    
    public function getTransactionById($id) {
        return null;
    }
    
    public function getFeeTransactions($parentTransactionId) {
        return [];
    }

    public function getActiveCampaign() {
        if ($this->pdo) {
            $stmt = $this->pdo->prepare("SELECT * FROM campaigns WHERE is_active = 1 ORDER BY id ASC LIMIT 1");
            $stmt->execute();
            return $stmt->fetch(PDO::FETCH_ASSOC);
        }

        return [
            'id' => 1,
            'name' => 'Demo Campaign',
            'menu_title' => 'Demo Menu',
            'root_prompt' => 'Welcome to the demo menu.',
            'bid_fee_min' => 30,
            'bid_fee_max' => 99,
            'bid_fee_prompt' => 'Please complete the bid on MPesa, ref: {{ref}}.',
            'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s')
        ];
    }

    public function listCampaignNodes($campaignId, $includeInactive = false) {
        if ($this->pdo) {
            if ($includeInactive) {
                $stmt = $this->pdo->prepare("
                    SELECT * FROM campaign_nodes
                    WHERE campaign_id = ?
                    ORDER BY sort_order ASC, id ASC
                ");
                $stmt->execute([$campaignId]);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            $stmt = $this->pdo->prepare("
                SELECT * FROM campaign_nodes
                WHERE campaign_id = ? AND is_active = 1
                ORDER BY sort_order ASC, id ASC
            ");
            $stmt->execute([$campaignId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return [];
    }
    
    public function getAllUsers() {
        return [$this->mockUser];
    }
    
    public function getAllTransactions($typeFilter = null, $statusFilter = null, $paymentStatusFilter = null, $paymentMethodFilter = null, $dateFrom = null, $dateTo = null, $limit = null, $isFeeFilter = null) {
        return [];
    }
    
    public function updateTransactionPayment($transactionId, $paymentData) {
        // No-op for simulator
        return true;
    }
}

