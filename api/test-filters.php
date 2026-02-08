<?php
/**
 * Test script to debug filter issues
 * Access via: /api/test-filters.php?type=loan&status=pending&is_fee=false
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

$storage = new Storage($pdo);

echo "<h2>Filter Test</h2>";
echo "<pre>";

echo "GET Parameters:\n";
print_r($_GET);

$typeFilter = $_GET['type'] ?? null;
$statusFilter = $_GET['status'] ?? null;
$isFeeFilter = $_GET['is_fee'] ?? null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;

echo "\nFilter Values:\n";
echo "Type: " . ($typeFilter ?? 'null') . "\n";
echo "Status: " . ($statusFilter ?? 'null') . "\n";
echo "Is Fee: " . ($isFeeFilter ?? 'null') . "\n";
echo "Date From: " . ($dateFrom ?? 'null') . "\n";
echo "Date To: " . ($dateTo ?? 'null') . "\n";

$transactions = $storage->getAllTransactions($typeFilter, $statusFilter, null, null, $dateFrom, $dateTo, null, $isFeeFilter);

echo "\nResults: " . count($transactions) . " transactions\n";
foreach ($transactions as $tx) {
    echo "ID: {$tx['id']}, Type: {$tx['type']}, Status: {$tx['status']}, Payment Status: " . ($tx['payment_status'] ?? 'null') . ", Is Fee: " . ($tx['is_fee'] ?? '0') . "\n";
}

echo "</pre>";

