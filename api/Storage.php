<?php
/**
 * Database Storage Layer
 */

class Storage {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    public function getUserByPhoneNumber($phoneNumber) {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE phone_number = ?");
        $stmt->execute([$phoneNumber]);
        return $stmt->fetch();
    }
    
    public function createUser($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO users (phone_number, id_number, balance, loan_limit, has_active_loan)
            VALUES (?, ?, ?, ?, ?)
        ");
        // MariaDB uses TINYINT(1), convert booleans properly
        $hasActiveLoan = isset($data['hasActiveLoan']) ? ((bool)$data['hasActiveLoan'] ? 1 : 0) : 0;
        $stmt->execute([
            $data['phoneNumber'],
            $data['idNumber'] ?? null,
            $data['balance'] ?? '0',
            $data['loanLimit'] ?? '25100',
            $hasActiveLoan
        ]);
        return $this->getUserByPhoneNumber($data['phoneNumber']);
    }
    
    public function updateUserBalance($id, $balance) {
        $stmt = $this->pdo->prepare("UPDATE users SET balance = ? WHERE id = ?");
        $stmt->execute([$balance, $id]);
        return $this->getUserById($id);
    }
    
    public function updateUserLoanLimit($id, $limit) {
        $stmt = $this->pdo->prepare("UPDATE users SET loan_limit = ? WHERE id = ?");
        $stmt->execute([$limit, $id]);
        return $this->getUserById($id);
    }
    
    public function setLoanStatus($id, $hasActiveLoan) {
        // MariaDB uses TINYINT(1)
        $stmt = $this->pdo->prepare("UPDATE users SET has_active_loan = ? WHERE id = ?");
        $stmt->execute([$hasActiveLoan, $id]);
        return $this->getUserById($id);
    }
    
    public function getUserById($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
    
    public function createTransaction($data) {
        $stmt = $this->pdo->prepare("
            INSERT INTO transactions (user_id, type, amount, reference, status, parent_transaction_id, is_fee, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
                // MySQL/MariaDB uses TINYINT(1), convert isFee to 0 or 1 (not boolean)
        $isFee = isset($data['isFee']) ? ((bool)$data['isFee'] ? 1 : 0) : 0;
        $source = $data['source'] ?? 'ussd'; // Default to 'ussd' for backward compatibility
        
        $stmt->execute([
            $data['userId'],
            $data['type'],
            $data['amount'],
            $data['reference'],
            $data['status'],
            $data['parentTransactionId'] ?? null,
            $isFee,
            $source
        ]);
        
        return $this->pdo->lastInsertId();
    }
    
    public function createFeeTransaction($userId, $amount, $reference, $parentTransactionId, $feeType = 'fee', $source = 'ussd') {
        return $this->createTransaction([
            'userId' => $userId,
            'type' => $feeType,
            'amount' => $amount,
            'reference' => $reference,
            'status' => 'pending',
            'parentTransactionId' => $parentTransactionId,
            'isFee' => true,
            'source' => $source
        ]);
    }
    
    public function getTransactionById($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM transactions WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
    
    public function getFeeTransactions($parentTransactionId) {
        // Use numeric comparison for MySQL/MariaDB TINYINT(1) compatibility
        // Works for MariaDB (TINYINT)
        $stmt = $this->pdo->prepare("SELECT * FROM transactions WHERE parent_transaction_id = ? AND is_fee = 1");
        $stmt->execute([$parentTransactionId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listAuctions($includeInactive = false) {
        if ($includeInactive) {
            $stmt = $this->pdo->query("SELECT * FROM auctions ORDER BY id ASC");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $stmt = $this->pdo->prepare("SELECT * FROM auctions WHERE is_active = 1 ORDER BY id ASC");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getActiveCampaign() {
        $stmt = $this->pdo->prepare("SELECT * FROM campaigns WHERE is_active = 1 ORDER BY id ASC LIMIT 1");
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function listCampaignNodes($campaignId, $includeInactive = false) {
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
    
    /**
     * Get pending fee transactions for a user (unpaid STK pushes)
     * Returns transactions with payment_status = 'pending' or NULL that are fees
     * Only checks transactions from the last 24 hours
     */
    public function getPendingFeeTransactions($userId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM transactions 
            WHERE user_id = ? 
            AND is_fee = 1 
            AND (payment_status = 'pending' OR payment_status IS NULL)
            AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY created_at DESC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get pending deposit transactions for a user (unpaid STK pushes)
     * Only checks transactions from the last 24 hours
     */
    public function getPendingDepositTransactions($userId) {
        $stmt = $this->pdo->prepare("
            SELECT * FROM transactions 
            WHERE user_id = ? 
            AND type = 'deposit'
            AND (payment_status = 'pending' OR payment_status IS NULL)
            AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY created_at DESC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getOrCreateSession($sessionId, $phoneNumber, $ussdCode) {
        $stmt = $this->pdo->prepare("SELECT * FROM ussd_sessions WHERE session_id = ?");
        $stmt->execute([$sessionId]);
        $session = $stmt->fetch();
        
        if ($session) {
            return $session;
        }
        
        $stmt = $this->pdo->prepare("
            INSERT INTO ussd_sessions (session_id, phone_number, ussd_code, input_history, current_menu)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$sessionId, $phoneNumber, $ussdCode, '', 'main']);
        
        return $this->getOrCreateSession($sessionId, $phoneNumber, $ussdCode);
    }
    
    public function updateSession($sessionId, $currentMenu, $inputHistory) {
        $stmt = $this->pdo->prepare("
            UPDATE ussd_sessions 
            SET current_menu = ?, input_history = ?, last_interaction = CURRENT_TIMESTAMP
            WHERE session_id = ?
        ");
        $stmt->execute([$currentMenu, $inputHistory, $sessionId]);
        
        $stmt = $this->pdo->prepare("SELECT * FROM ussd_sessions WHERE session_id = ?");
        $stmt->execute([$sessionId]);
        return $stmt->fetch();
    }
    
    public function getSession($sessionId) {
        $stmt = $this->pdo->prepare("SELECT * FROM ussd_sessions WHERE session_id = ?");
        $stmt->execute([$sessionId]);
        return $stmt->fetch();
    }
    
    public function getAllUsers() {
        $stmt = $this->pdo->query("SELECT * FROM users ORDER BY id DESC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getAllTransactions($typeFilter = null, $statusFilter = null, $paymentStatusFilter = null, $paymentMethodFilter = null, $dateFrom = null, $dateTo = null, $limit = null, $isFeeFilter = null, $sourceFilter = null, $phoneNumberFilter = null) {
        $query = "SELECT t.*, u.phone_number 
                  FROM transactions t 
                  LEFT JOIN users u ON t.user_id = u.id 
                  WHERE 1=1";
        $params = [];
        
        // Filter by phone number
        if ($phoneNumberFilter && $phoneNumberFilter !== '') {
            // Format phone number (remove spaces, ensure 254 format)
            $phoneNumberFilter = preg_replace('/[^0-9]/', '', $phoneNumberFilter);
            if (substr($phoneNumberFilter, 0, 1) === '0') {
                $phoneNumberFilter = '254' . substr($phoneNumberFilter, 1);
            }
            $query .= " AND u.phone_number LIKE ?";
            $params[] = '%' . $phoneNumberFilter . '%';
        }
        
        // Filter by fee status (true = fees only, false = exclude fees, null = all)
        // Use numeric comparisons for MySQL/MariaDB TINYINT(1) compatibility
        if ($isFeeFilter !== null && $isFeeFilter !== '') {
            if ($isFeeFilter === 'true' || $isFeeFilter === true || $isFeeFilter === '1') {
                $query .= " AND t.is_fee = 1";
            } else if ($isFeeFilter === 'false' || $isFeeFilter === false || $isFeeFilter === '0') {
                $query .= " AND (t.is_fee = 0 OR t.is_fee IS NULL)";
            }
        }
        
        if ($typeFilter && $typeFilter !== 'all' && $typeFilter !== '') {
            $query .= " AND t.type = ?";
            $params[] = $typeFilter;
        }
        
        if ($statusFilter && $statusFilter !== 'all' && $statusFilter !== '') {
            // Combined status filter - checks both transaction status and payment status
            if ($statusFilter === 'paid') {
                $query .= " AND COALESCE(t.payment_status, t.status) = 'paid'";
            } else if ($statusFilter === 'failed') {
                $query .= " AND COALESCE(t.payment_status, t.status) = 'failed'";
            } else {
                // For pending/completed, check both fields
                $query .= " AND (t.status = ? OR COALESCE(t.payment_status, t.status) = ?)";
                $params[] = $statusFilter;
                $params[] = $statusFilter;
            }
        }
        
        if ($sourceFilter && $sourceFilter !== 'all' && $sourceFilter !== '') {
            $query .= " AND COALESCE(t.source, 'ussd') = ?";
            $params[] = $sourceFilter;
        }
        
        if ($dateFrom && $dateFrom !== '') {
            $query .= " AND DATE(t.created_at) >= ?";
            $params[] = $dateFrom;
        }
        
        if ($dateTo && $dateTo !== '') {
            $query .= " AND DATE(t.created_at) <= ?";
            $params[] = $dateTo;
        }
        
        $query .= " ORDER BY t.created_at DESC";
        
        if ($limit) {
            $query .= " LIMIT ?";
            $params[] = $limit;
        }
        
        // Log the query for debugging (remove in production)
        error_log("Transaction query: " . $query);
        error_log("Transaction params: " . json_encode($params));
        
        $stmt = $this->pdo->prepare($query);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("Transaction results count: " . count($results));
        
        return $results;
    }
    
    public function updateTransactionPayment($transactionId, $paymentData) {
        $fields = [];
        $params = [];
        
        if (isset($paymentData['payment_method'])) {
            $fields[] = "payment_method = ?";
            $params[] = $paymentData['payment_method'];
        }
        
        if (isset($paymentData['mpesa_receipt'])) {
            $fields[] = "mpesa_receipt = ?";
            $params[] = $paymentData['mpesa_receipt'];
        }
        
        if (isset($paymentData['mpesa_transaction_id'])) {
            $fields[] = "mpesa_transaction_id = ?";
            $params[] = $paymentData['mpesa_transaction_id'];
        }
        
        if (isset($paymentData['merchant_request_id'])) {
            $fields[] = "merchant_request_id = ?";
            $params[] = $paymentData['merchant_request_id'];
        }
        
        if (isset($paymentData['payment_phone'])) {
            $fields[] = "payment_phone = ?";
            $params[] = $paymentData['payment_phone'];
        }
        
        if (isset($paymentData['payment_status'])) {
            $fields[] = "payment_status = ?";
            $params[] = $paymentData['payment_status'];
        }
        
        if (isset($paymentData['payment_date'])) {
            $fields[] = "payment_date = ?";
            $params[] = $paymentData['payment_date'];
        }
        
        if (isset($paymentData['payment_name'])) {
            $fields[] = "payment_name = ?";
            $params[] = $paymentData['payment_name'];
        }
        
        if (empty($fields)) {
            return false;
        }
        
        $params[] = $transactionId;
        $query = "UPDATE transactions SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $this->pdo->prepare($query);
        return $stmt->execute($params);
    }
}

