# Import Categorization Research: Mixed Personal/Business Expenses

## Problem Statement

During import, transactions from bank statements and credit cards are not being correctly categorized, particularly when personal and business expenses are mixed in the same accounts. The current system lacks context to distinguish between personal and business transactions during automated categorization.

## Current System Analysis

### How Import Currently Works

1. **Receipt Processing** (`app/actions/scan-receipt.ts`):
   - Uses `ReceiptProcessor` → `BaseDocumentProcessor.categorizeDocument()`
   - Calls `CategoryEngine.categorizeWithAI()`
   - Returns `categoryId`, `categoryName`, and `businessId` ✅
   - **Status**: Works correctly for receipts

2. **Bank Statement Processing** (`lib/import/process-bank-statement.ts`):
   - Uses `BankAccountProcessor` or `CreditCardProcessor`
   - Calls `BaseStatementProcessor.categorizeTransaction()`
   - **Problem**: Only returns `categoryId` and `categoryName` ❌
   - **Missing**: `businessId` is not captured or returned

3. **Categorization Engine** (`lib/categorization/engine.ts`):
   - Multi-layered strategy: RuleMatcher → HistoryMatcher → AiMatcher
   - `RuleMatcher` can assign `businessId` if rule has `businessId` set ✅
   - `HistoryMatcher` can assign `businessId` from past transactions ✅
   - `AiMatcher` does NOT consider business context ❌

4. **AI Prompt** (`lib/ai/prompts/categorization.ts`):
   - Includes merchant, description, amount
   - Includes user's `usageType` (personal/business/mixed)
   - **Missing**: User's businesses list, business-specific context
   - **Missing**: Request to determine if transaction is business or personal

### Key Issues Identified

1. **BaseStatementProcessor.categorizeTransaction()** doesn't return `businessId`
2. **AI prompt** doesn't include business context or ask for business/personal classification
3. **No business-aware categorization** during import - AI can't distinguish context
4. **History matching** may assign wrong `businessId` if past transactions were miscategorized

## Industry Best Practices

### Approaches Used by Leading Apps

1. **YNAB (You Need A Budget)**:
   - Manual categorization required (no auto-categorization)
   - Users assign categories and flags manually
   - **Approach**: User-driven, no AI

2. **Mint/Intuit**:
   - Rule-based categorization with merchant matching
   - User can set "business" flag per transaction
   - **Approach**: Rules + manual flags

3. **QuickBooks**:
   - Account-based separation (separate accounts for business)
   - Category rules with business context
   - **Approach**: Account-level separation + rules

4. **Expensify**:
   - Receipt-based (each receipt is business or personal)
   - SmartScan AI with business context
   - **Approach**: Document-level context + AI

5. **Tiller**:
   - AutoCat rules engine
   - User-defined rules with business flags
   - **Approach**: Advanced rule engine

### Common Solutions

1. **Account-Level Separation**:
   - Separate bank accounts/cards for business
   - Assign business at import time based on account
   - **Pros**: Simple, clear separation
   - **Cons**: Doesn't work for mixed accounts

2. **Merchant-Based Rules**:
   - Create rules: "Starbucks" → Personal, "Office Depot" → Business
   - Store businessId in rules
   - **Pros**: Works well for consistent merchants
   - **Cons**: Requires setup, doesn't handle ambiguous merchants

3. **AI with Business Context**:
   - Provide AI with user's businesses list
   - Ask AI to determine business vs personal + which business
   - **Pros**: Handles edge cases, learns from context
   - **Cons**: More expensive, requires good prompts

4. **Hybrid Approach** (Recommended):
   - Rules first (with businessId) → History (with businessId) → AI (with business context)
   - Post-import review/editing interface
   - **Pros**: Best accuracy, user can correct
   - **Cons**: More complex implementation

## Recommended Solution for Turbo Invoice

### Phase 1: Enhance AI Categorization (Immediate)

1. **Update AI Prompt** to include:
   - User's businesses list (names, types)
   - Request to determine: Personal vs Business (and which business)
   - Business-specific context (e.g., "If this is a business expense, which business?")

2. **Update Categorization Schema** to return:
   ```typescript
   {
     categoryName: string;
     confidence: number;
     isNewCategory: boolean;
     isBusinessExpense: boolean;  // NEW
     businessId: string | null;    // NEW
     businessName: string | null;  // NEW (for validation)
   }
   ```

3. **Update BaseStatementProcessor** to:
   - Return `businessId` from categorization result
   - Pass `businessId` to transaction records

### Phase 2: Enhanced Business Context (Short-term)

1. **Business-Aware Rules**:
   - Allow rules to specify businessId
   - Match merchant → category + business
   - Already implemented ✅, but needs better UI

2. **Business-Aware History**:
   - When matching history, consider businessId from past transactions
   - If merchant was used for Business A before, suggest Business A
   - Already implemented ✅

3. **Account-Level Defaults** (Future):
   - Allow users to set default business per account/card
   - Use as fallback when AI/history can't determine

### Phase 3: Transaction Edit Enhancement (Short-term) ⭐ NEW

1. **"Create Rule" Quick Action**:
   - Add "Create Rule" button in transaction edit forms (receipts & bank transactions)
   - Pre-populate rule with current transaction's merchant/category/business
   - One-click rule creation from transaction edits

2. **Similar Transactions Panel**:
   - Show similar transactions when editing (same merchant, similar amounts, dates)
   - Display how they were categorized (category + business)
   - Help users make informed decisions: "5 similar transactions → 4 were Business A, 1 was Personal"
   - Visual indicators for patterns

3. **Smart Rule Suggestions**:
   - "Create rule for all similar transactions?" prompt
   - Show impact: "This will affect 12 future transactions"
   - Allow bulk rule creation from pattern

### Phase 4: Post-Import Review (Medium-term)

1. **Bulk Edit Interface**:
   - Review uncategorized or low-confidence transactions
   - Bulk assign business/category
   - Learn from corrections

2. **Smart Suggestions**:
   - "This merchant is usually business" notifications
   - "Similar transactions were marked as Business A" hints

## Implementation Plan

### Step 1: Update AI Categorization Prompt
- Add businesses list to prompt context
- Request business/personal classification
- Update schema to return businessId

### Step 2: Update BaseStatementProcessor
- Capture businessId from categorization result
- Return businessId in ProcessedTransaction
- Update bank statement transaction insertion to include businessId

### Step 3: Update Import Flow
- Pass user's businesses to categorization engine
- Store businessId in bankStatementTransactions table
- Update activity logs to show business assignment

### Step 4: Testing & Validation
- Test with mixed personal/business transactions
- Verify AI correctly identifies business vs personal
- Validate businessId assignment accuracy

## Technical Considerations

### Database Schema
- `bankStatementTransactions.businessId` already exists ✅
- `receipts.businessId` already exists ✅
- No schema changes needed

### Performance
- Fetching businesses list adds one query per import batch (acceptable)
- AI prompt will be slightly longer (minimal cost increase)
- Categorization already uses AI, so no additional API calls

### User Experience
- No UI changes required initially (backend improvement)
- Future: Add business assignment UI during import
- Future: Add bulk edit interface for post-import review

## Success Metrics

1. **Accuracy**: % of transactions correctly assigned businessId during import
2. **User Corrections**: Reduction in manual businessId edits post-import
3. **Confidence**: AI confidence scores for business/personal classification
4. **Coverage**: % of transactions with businessId assigned (vs null)

## Next Steps

1. ✅ Research complete
2. ⏭️ Implement AI prompt enhancement
3. ⏭️ Update BaseStatementProcessor
4. ⏭️ Add "Create Rule" + Similar Transactions to edit forms
5. ⏭️ Test with real mixed transactions
6. ⏭️ Iterate based on results

## Phase 3 Implementation Details: Transaction Edit Enhancement

### Components to Update

1. **ReceiptForm** (`components/receipts/receipt-form.tsx`):
   - Add "Create Rule" button near category/business fields
   - Add similar transactions panel (collapsible)
   - Show rule creation dialog

2. **BankTransactionForm** (`components/bank-transactions/transaction-form.tsx`):
   - Same enhancements as ReceiptForm

3. **New Component: SimilarTransactionsPanel**:
   - Query similar transactions (same merchant, ±30 days, similar amounts)
   - Display in compact list with category/business badges
   - Show statistics: "4 of 5 were Business A"

4. **New Component: CreateRuleDialog**:
   - Pre-filled form with current transaction data
   - Option to create merchant rule or description rule
   - Show impact preview

### Server Actions Needed

1. **getSimilarTransactions**:
   - Query receipts + bank transactions
   - Match by merchant name (case-insensitive)
   - Filter by date range (±30 days) and amount similarity (±20%)
   - Return with category and business info

2. **createRuleFromTransaction**:
   - Create merchant rule from transaction
   - Optionally create description rule
   - Return rule ID for confirmation

### UI/UX Flow

1. User edits transaction → sees "Similar Transactions" panel
2. Panel shows: "5 similar transactions found"
3. User sees pattern: "4 were Business A, 1 was Personal"
4. User clicks "Create Rule" → dialog opens
5. Dialog pre-fills: Merchant, Category, Business
6. User confirms → rule created
7. Toast: "Rule created! This will affect 12 future transactions"

### Benefits

- **Faster rule creation**: No need to navigate to Settings → Rules
- **Informed decisions**: See patterns before creating rules
- **Better accuracy**: Users understand context before committing
- **Reduced clicks**: Create rules where you're already editing

