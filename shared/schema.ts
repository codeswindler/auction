import { pgTable, text, serial, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  idNumber: text("id_number"),
  balance: numeric("balance").default("0").notNull(),
  loanLimit: numeric("loan_limit").default("25100").notNull(),
  hasActiveLoan: boolean("has_active_loan").default(false),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // 'loan', 'withdrawal', 'deposit', 'loan_fee', 'withdrawal_fee'
  amount: numeric("amount").notNull(),
  reference: text("reference").notNull(),
  status: text("status").notNull(), // 'pending', 'completed'
  parentTransactionId: integer("parent_transaction_id"), // Links fee transactions to main transaction
  isFee: boolean("is_fee").default(false), // True if this is a fee transaction
  source: text("source").default("ussd"), // 'ussd' or 'web' - where the transaction originated
  createdAt: timestamp("created_at").defaultNow(),
});

export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  amount: numeric("amount").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  menuTitle: text("menu_title").notNull(),
  rootPrompt: text("root_prompt").notNull(),
  bidFeeMin: numeric("bid_fee_min").default("30").notNull(),
  bidFeeMax: numeric("bid_fee_max").default("99").notNull(),
  bidFeePrompt: text("bid_fee_prompt").notNull().default("Please complete the bid on MPesa, ref: {{ref}}."),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignNodes = pgTable("campaign_nodes", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  parentId: integer("parent_id"),
  label: text("label").notNull(),
  prompt: text("prompt"),
  actionType: text("action_type"),
  actionPayload: text("action_payload"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ussdSessions = pgTable("ussd_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  phoneNumber: text("phone_number").notNull(),
  ussdCode: text("ussd_code").notNull(),
  inputHistory: text("input_history").notNull().default(""), // Store the INPUT parameter history
  currentMenu: text("current_menu").notNull().default("main"),
  lastInteraction: timestamp("last_interaction").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertAuctionSchema = createInsertSchema(auctions).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true });
export const insertCampaignNodeSchema = createInsertSchema(campaignNodes).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = z.infer<typeof insertAuctionSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignNode = typeof campaignNodes.$inferSelect;
export type InsertCampaignNode = z.infer<typeof insertCampaignNodeSchema>;
export type USSDSession = typeof ussdSessions.$inferSelect;

// Types for the USSD API
export interface USSDRequest {
  phoneNumber: string;
  sessionId: string;
  ussdCode: string;
  input: string; // Full input like "*415*1*25000#"
}

export interface USSDResponse {
  message: string; // Full response like "CON Welcome..." or "END Thank you..."
}
