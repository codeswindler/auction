<?php
/**
 * Onfon Media SMS Service
 * Handles SMS sending via Onfon Media API
 * Converted from guzabox TypeScript implementation
 */

class OnfonSmsService {
    private $baseUrl;
    private $accessKey;
    private $apiKey;
    private $clientId;
    private $senderId;

    public function __construct() {
        $this->baseUrl = getenv('ONFON_BASE_URL') ?: 'https://api.onfonmedia.co.ke/v1/sms';
        $this->accessKey = getenv('ONFON_ACCESS_KEY') ?: '';
        $this->apiKey = getenv('ONFON_API_KEY') ?: '';
        $this->clientId = getenv('ONFON_CLIENT_ID') ?: '';
        $this->senderId = getenv('ONFON_SENDER_ID') ?: '';
    }

    /**
     * Send SMS via Onfon Media
     * @param string $to Phone number (will be normalized)
     * @param string $message SMS message text
     * @return array ['status' => 'success'|'failed', 'message' => string, 'messageId' => string|null]
     */
    public function send($to, $message) {
        try {
            if (!$this->accessKey || !$this->apiKey || !$this->clientId || !$this->senderId) {
                error_log("Onfon SMS credentials check: " . json_encode([
                    'hasAccessKey' => !!$this->accessKey,
                    'hasApiKey' => !!$this->apiKey,
                    'hasClientId' => !!$this->clientId,
                    'hasSenderId' => !!$this->senderId,
                    'accessKeyLength' => strlen($this->accessKey),
                    'apiKeyLength' => strlen($this->apiKey),
                    'clientId' => $this->clientId,
                    'senderId' => $this->senderId,
                ]));
                return [
                    'status' => 'failed',
                    'message' => 'Onfon SMS credentials are not configured',
                ];
            }

            // Log credential info (without exposing full values) for debugging
            error_log("Onfon credentials loaded: " . json_encode([
                'accessKeyLength' => strlen($this->accessKey),
                'accessKeyPrefix' => substr($this->accessKey, 0, 3) . '...',
                'apiKeyLength' => strlen($this->apiKey),
                'apiKeyPrefix' => substr($this->apiKey, 0, 3) . '...',
                'clientId' => $this->clientId,
                'senderId' => $this->senderId,
            ]));

            // Normalize phone number (remove non-digits)
            $mobile = preg_replace('/[^0-9]/', '', $to);
            $sendUrl = $this->baseUrl . '/SendBulkSMS';
            
            // Trim SenderId to remove any leading/trailing whitespace
            $trimmedSenderId = trim($this->senderId);

            $requestData = [
                'ApiKey' => $this->apiKey,
                'ClientId' => $this->clientId,
                'SenderId' => $trimmedSenderId,
                'MessageParameters' => [
                    [
                        'Number' => $mobile,
                        'Text' => $message,
                    ],
                ],
            ];

            error_log("Sending SMS via Onfon Media: " . json_encode([
                'url' => $sendUrl,
                'clientId' => $this->clientId,
                'senderId' => $trimmedSenderId,
                'senderIdLength' => strlen($trimmedSenderId),
                'senderIdBytes' => strlen($trimmedSenderId),
                'mobile' => $mobile,
                'messageLength' => strlen($message),
                'requestData' => [
                    'ApiKey' => '[REDACTED]',
                    'ClientId' => $this->clientId,
                    'SenderId' => $trimmedSenderId,
                    'MessageParameters' => $requestData['MessageParameters'],
                ],
            ]));

            $ch = curl_init($sendUrl);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'AccessKey: ' . $this->accessKey,
                'Content-Type: application/json',
            ]);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                error_log("Onfon SMS curl error: {$curlError}");
                return [
                    'status' => 'failed',
                    'message' => "Network error: {$curlError}",
                ];
            }

            $result = json_decode($response, true);
            error_log("Onfon Media API raw response: " . json_encode($result, JSON_PRETTY_PRINT));
            
            $normalized = $this->normalizeProviderResult($result);

            if ($normalized['status'] === 'success') {
                $messageId = $normalized['messageId'] ?? null;
                error_log("SMS sent successfully to {$to}." . ($messageId ? " Message ID: {$messageId}" : ""));
                return $normalized;
            }

            error_log("SMS sending failed. Full API response: " . json_encode($result, JSON_PRETTY_PRINT));
            return $normalized;
        } catch (Exception $e) {
            error_log("Onfon SMS service error: " . $e->getMessage());
            return [
                'status' => 'failed',
                'message' => 'SMS service error: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Normalize Onfon API response to standard format
     */
    private function normalizeProviderResult($result) {
        // Onfon Media uses ErrorCode format: ErrorCode 0 = Success
        $errorCode = $result['ErrorCode'] ?? $result['errorCode'] ?? null;
        
        if ($errorCode === 0 || $errorCode === '0') {
            // Check for message-level errors in Data array
            if (is_array($result['Data'] ?? null) && count($result['Data']) > 0) {
                $firstMessage = $result['Data'][0];
                $messageErrorCode = $firstMessage['MessageErrorCode'] ?? $firstMessage['messageErrorCode'] ?? null;
                
                // If MessageErrorCode exists and is non-zero, treat as failure
                if ($messageErrorCode !== null && $messageErrorCode !== 0 && $messageErrorCode !== '0') {
                    $messageErrorDescription = $firstMessage['MessageErrorDescription'] ?? $firstMessage['messageErrorDescription'] ?? '';
                    $errorMessage = $messageErrorDescription 
                        ? "MessageErrorCode {$messageErrorCode}: {$messageErrorDescription}"
                        : "MessageErrorCode {$messageErrorCode}";
                    
                    return ['status' => 'failed', 'message' => $errorMessage];
                }
                
                // Success - extract message ID from Data array
                $messageId = $firstMessage['MessageId'] ?? $firstMessage['messageId'] ?? null;
                if ($messageId) {
                    return ['status' => 'success', 'messageId' => $messageId];
                }
            }
            
            // Also check for messageId at root level
            $messageId = $result['messageId'] ?? $result['MessageId'] ?? null;
            if ($messageId) {
                return ['status' => 'success', 'messageId' => $messageId];
            }
            
            // If ErrorCode is 0 but no message ID found, still treat as success
            return ['status' => 'success'];
        }

        // Build error message from Onfon's ErrorDescription or other fields
        $errorMessage = '';
        
        if (is_array($result['Data'] ?? null) && count($result['Data']) > 0) {
            $firstMessage = $result['Data'][0];
            $messageErrorDescription = $firstMessage['MessageErrorDescription'] ?? $firstMessage['messageErrorDescription'] ?? '';
            $messageErrorCode = $firstMessage['MessageErrorCode'] ?? $firstMessage['messageErrorCode'] ?? null;
            
            if ($messageErrorDescription && trim($messageErrorDescription) && $messageErrorDescription !== 'null') {
                $errorMessage = $messageErrorDescription;
                if ($messageErrorCode !== null) {
                    $errorMessage = "MessageErrorCode {$messageErrorCode}: {$errorMessage}";
                }
            }
        }
        
        // Fallback to root-level error fields
        if (!$errorMessage) {
            if (isset($result['ErrorDescription']) && is_string($result['ErrorDescription']) && trim($result['ErrorDescription']) && $result['ErrorDescription'] !== 'null') {
                $errorMessage = $result['ErrorDescription'];
            } elseif (isset($result['errorDescription']) && is_string($result['errorDescription']) && trim($result['errorDescription']) && $result['errorDescription'] !== 'null') {
                $errorMessage = $result['errorDescription'];
            } elseif (isset($result['message']) && is_string($result['message']) && trim($result['message'])) {
                $errorMessage = $result['message'];
            } elseif (isset($result['Message']) && is_string($result['Message']) && trim($result['Message'])) {
                $errorMessage = $result['Message'];
            }
        }
        
        // Include error code if available
        if ($errorCode !== null) {
            $errorMessage = $errorMessage 
                ? "ErrorCode {$errorCode}: {$errorMessage}"
                : "ErrorCode {$errorCode}";
        }
        
        // If still no message, include raw response for debugging
        if (!$errorMessage) {
            $rawResponse = json_encode($result);
            $errorMessage = "Unknown error from Onfon Media SMS. Raw response: {$rawResponse}";
        } else {
            // Append raw response for debugging even when we have an error message
            $rawResponse = json_encode($result);
            $errorMessage = "{$errorMessage} (Raw response: {$rawResponse})";
        }

        return ['status' => 'failed', 'message' => $errorMessage];
    }

    /**
     * Send win notification SMS
     */
    public function sendWinNotification($phoneNumber, $amount, $betId) {
        $message = "CONGRATULATIONS! You won Ksh {$amount}!\n\nBet ID: {$betId}\n\nYour prize will be sent to your M-Pesa account shortly.\n\nThank you for playing LiveAuction!";
        return $this->send($phoneNumber, $message);
    }

    /**
     * Send loss notification SMS
     */
    public function sendLossNotification($phoneNumber, $betId, $selectedBox, $boxResults, $prefixLine = 'Almost won. Try again.') {
        $boxText = '';
        foreach ($boxResults as $i => $value) {
            $boxNum = $i + 1;
            $boxText .= "Box {$boxNum}: {$value}\n";
        }
        $boxText = trim($boxText);
        
        $message = "{$prefixLine}\n\nYou chose {$selectedBox}\n\n{$boxText}\n\nBet: {$betId}\nDial *855*22# to win more.";
        return $this->send($phoneNumber, $message);
    }

    /**
     * Send OTP SMS
     */
    public function sendOtp($phoneNumber, $code) {
        $message = "Your LiveAuction OTP is {$code}. It expires in 5 minutes.";
        return $this->send($phoneNumber, $message);
    }
}
