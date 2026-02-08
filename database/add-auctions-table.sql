-- Auctions table for USSD active listings
CREATE TABLE IF NOT EXISTS auctions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
