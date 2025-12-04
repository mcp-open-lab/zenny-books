"use server";

import { createAuthenticatedAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";
import {
  findDuplicateBankTransactions,
  findDuplicateReceipts,
  markAsDuplicate as markAsDuplicateService,
  unmarkAsDuplicate as unmarkAsDuplicateService,
} from "@/lib/transactions/duplicate-detector";
import {
  markAsInternalTransfer as markAsInternalTransferService,
  unmarkAsInternalTransfer as unmarkAsInternalTransferService,
  detectCreditCardPaymentTransaction,
  detectInternalTransferByDescription,
  findMatchingTransfers,
} from "@/lib/transactions/transfer-detector";
import {
  detectInstallmentPlanCreditTransaction,
  markAsInstallmentPlanCredit as markAsInstallmentPlanCreditService,
} from "@/lib/transactions/installment-plan-detector";

type ToggleExclusionInput = {
  transactionId: string;
  transactionType: "receipt" | "bank_transaction";
  exclude: boolean;
};

export const toggleExcludeFromTotals = createAuthenticatedAction(
  "toggleExcludeFromTotals",
  async (userId, input: ToggleExclusionInput) => {
    const { transactionId, transactionType, exclude } = input;

    const flags: TransactionFlags | null = exclude
      ? {
          isExcludedFromTotals: true,
          exclusionReason: "manual",
          userVerified: true,
          verifiedAt: new Date().toISOString(),
        }
      : null;

    if (transactionType === "receipt") {
      await db
        .update(receipts)
        .set({ transactionFlags: flags })
        .where(
          and(eq(receipts.id, transactionId), eq(receipts.userId, userId))
        );
    } else {
      // Verify ownership first, then update
      const txCheck = await db
        .select({ id: bankStatementTransactions.id })
        .from(bankStatementTransactions)
        .innerJoin(
          bankStatements,
          eq(bankStatementTransactions.bankStatementId, bankStatements.id)
        )
        .innerJoin(documents, eq(bankStatements.documentId, documents.id))
        .where(
          and(
            eq(bankStatementTransactions.id, transactionId),
            eq(documents.userId, userId)
          )
        )
        .limit(1);

      if (txCheck.length > 0) {
        await db
          .update(bankStatementTransactions)
          .set({ transactionFlags: flags })
          .where(eq(bankStatementTransactions.id, transactionId));
      }
    }

    return { success: true };
  }
);

type FindDuplicatesInput = {
  transactionId: string;
  transactionType: "receipt" | "bank_transaction";
  merchantName: string | null;
  amount: string | null;
  date: Date | null;
};

export const findDuplicates = createAuthenticatedAction(
  "findDuplicates",
  async (userId, input: FindDuplicatesInput) => {
    const { transactionType, merchantName, amount, date } = input;

    const result =
      transactionType === "receipt"
        ? await findDuplicateBankTransactions(
            userId,
            merchantName,
            amount,
            date
          )
        : await findDuplicateReceipts(userId, merchantName, amount, date);

    return { success: true, data: result };
  }
);

type MarkAsDuplicateInput = {
  transactionId: string;
  transactionType: "receipt" | "bank_transaction";
  linkedTransactionId: string;
  linkedTransactionType: "receipt" | "bank_transaction";
};

export const markAsDuplicate = createAuthenticatedAction(
  "markAsDuplicate",
  async (userId, input: MarkAsDuplicateInput) => {
    const {
      transactionId,
      transactionType,
      linkedTransactionId,
      linkedTransactionType,
    } = input;

    await markAsDuplicateService(
      transactionId,
      transactionType,
      linkedTransactionId,
      linkedTransactionType,
      userId
    );

    return { success: true };
  }
);

type UnmarkAsDuplicateInput = {
  transactionId: string;
  transactionType: "receipt" | "bank_transaction";
};

export const unmarkAsDuplicate = createAuthenticatedAction(
  "unmarkAsDuplicate",
  async (userId, input: UnmarkAsDuplicateInput) => {
    const { transactionId, transactionType } = input;

    await unmarkAsDuplicateService(transactionId, transactionType, userId);

    return { success: true };
  }
);

type MarkAsInternalTransferInput = {
  transactionId: string;
  transferType?: "internal" | "credit_card_payment";
};

export const markAsInternalTransfer = createAuthenticatedAction(
  "markAsInternalTransfer",
  async (userId, input: MarkAsInternalTransferInput) => {
    const { transactionId, transferType = "internal" } = input;

    await markAsInternalTransferService(transactionId, userId, transferType);

    return { success: true };
  }
);

type UnmarkAsInternalTransferInput = {
  transactionId: string;
};

export const unmarkAsInternalTransfer = createAuthenticatedAction(
  "unmarkAsInternalTransfer",
  async (userId, input: UnmarkAsInternalTransferInput) => {
    const { transactionId } = input;

    await unmarkAsInternalTransferService(transactionId, userId);

    return { success: true };
  }
);

type DetectTransferInput = {
  description: string | null;
  amount: string | null;
  date: Date | null;
  transactionId?: string;
};

export const detectTransfer = createAuthenticatedAction(
  "detectTransfer",
  async (userId, input: DetectTransferInput) => {
    const { description, amount, date, transactionId } = input;

    // Check description patterns for transfers
    const creditCardResult = detectCreditCardPaymentTransaction(
      description,
      amount
    );
    if (creditCardResult.isTransfer) {
      return { success: true, data: creditCardResult };
    }

    const transferResult = detectInternalTransferByDescription(description);
    if (transferResult.isTransfer) {
      return { success: true, data: transferResult };
    }

    // Check for matching transfers
    if (date) {
      const matchingResult = await findMatchingTransfers(
        userId,
        amount,
        date,
        transactionId
      );
      return { success: true, data: matchingResult };
    }

    return {
      success: true,
      data: {
        isTransfer: false,
        matches: [],
        autoDetected: false,
      },
    };
  }
);

type MarkAsInstallmentPlanCreditInput = {
  transactionId: string;
};

export const markAsInstallmentPlanCredit = createAuthenticatedAction(
  "markAsInstallmentPlanCredit",
  async (userId, input: MarkAsInstallmentPlanCreditInput) => {
    const { transactionId } = input;
    await markAsInstallmentPlanCreditService(transactionId, userId);
    return { success: true };
  }
);

const VALID_BNPL_PROVIDERS = [
  "affirm",
  "klarna",
  "afterpay",
  "apple_pay_later",
  "other",
] as const;

type BnplProvider = (typeof VALID_BNPL_PROVIDERS)[number];

type MarkAsBnplInput = {
  transactionId: string;
  transactionType: "receipt" | "bank_transaction";
  originalAmount: string;
  remainingInstallments: number;
  provider: string;
};

export const markAsBnpl = createAuthenticatedAction(
  "markAsBnpl",
  async (userId, input: MarkAsBnplInput) => {
    const {
      transactionId,
      transactionType,
      originalAmount,
      remainingInstallments,
      provider,
    } = input;

    const validProvider: BnplProvider = VALID_BNPL_PROVIDERS.includes(
      provider as BnplProvider
    )
      ? (provider as BnplProvider)
      : "other";

    const flags: TransactionFlags = {
      isBnplPurchase: true,
      bnplOriginalAmount: originalAmount,
      bnplRemainingInstallments: remainingInstallments,
      bnplProvider: validProvider,
      userVerified: true,
      verifiedAt: new Date().toISOString(),
    };

    if (transactionType === "receipt") {
      await db
        .update(receipts)
        .set({ transactionFlags: flags })
        .where(
          and(eq(receipts.id, transactionId), eq(receipts.userId, userId))
        );
    } else {
      // Verify ownership first, then update
      const txCheck = await db
        .select({ id: bankStatementTransactions.id })
        .from(bankStatementTransactions)
        .innerJoin(
          bankStatements,
          eq(bankStatementTransactions.bankStatementId, bankStatements.id)
        )
        .innerJoin(documents, eq(bankStatements.documentId, documents.id))
        .where(
          and(
            eq(bankStatementTransactions.id, transactionId),
            eq(documents.userId, userId)
          )
        )
        .limit(1);

      if (txCheck.length > 0) {
        await db
          .update(bankStatementTransactions)
          .set({ transactionFlags: flags })
          .where(eq(bankStatementTransactions.id, transactionId));
      }
    }

    return { success: true };
  }
);
