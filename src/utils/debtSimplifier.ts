export interface Member {
  id: string;
  name: string;
  upiId: string;
}

export type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  category: 'food' | 'travel' | 'rent' | 'utilities' | 'entertainment' | 'other';
  date: string;
  splitType: SplitType;
  splits: { [memberId: string]: number }; // Stores percentages, exact amounts, or shares per member
  excludedMemberIds?: string[]; // Members who are not part of this split (for equal split customisation)
}

export interface Settlement {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  status: 'pending' | 'settled';
  date: string;
}

export interface Transaction {
  fromId: string;
  fromName: string;
  fromUpi: string;
  toId: string;
  toName: string;
  toUpi: string;
  amount: number;
}

/**
 * Calculates the net balance for each member in the group.
 * Positive balance means they are owed money (creditor).
 * Negative balance means they owe money (debtor).
 */
export function calculateBalances(members: Member[], expenses: Expense[], settlements: Settlement[]): { [memberId: string]: number } {
  const balances: { [memberId: string]: number } = {};
  
  // Initialize balances to 0
  members.forEach(m => {
    balances[m.id] = 0;
  });

  // Process all expenses
  expenses.forEach(expense => {
    const { amount, payerId, splitType, splits, excludedMemberIds = [] } = expense;
    
    // 1. Calculate how much each member owes for this expense
    const owedAmounts: { [memberId: string]: number } = {};
    const activeMembers = members.filter(m => !excludedMemberIds.includes(m.id));
    
    if (activeMembers.length === 0) return;

    if (splitType === 'equal') {
      const share = amount / activeMembers.length;
      activeMembers.forEach(m => {
        owedAmounts[m.id] = share;
      });
    } else if (splitType === 'percentage') {
      activeMembers.forEach(m => {
        const pct = splits[m.id] || 0;
        owedAmounts[m.id] = (amount * pct) / 100;
      });
    } else if (splitType === 'exact') {
      activeMembers.forEach(m => {
        owedAmounts[m.id] = splits[m.id] || 0;
      });
    } else if (splitType === 'shares') {
      const totalShares = activeMembers.reduce((sum, m) => sum + (splits[m.id] || 0), 0);
      if (totalShares > 0) {
        activeMembers.forEach(m => {
          const shareVal = splits[m.id] || 0;
          owedAmounts[m.id] = (amount * shareVal) / totalShares;
        });
      } else {
        // Fallback to equal split if total shares is 0
        const share = amount / activeMembers.length;
        activeMembers.forEach(m => {
          owedAmounts[m.id] = share;
        });
      }
    }

    // 2. Adjust net balances: Payer gains full expense amount, participants lose their owed shares
    if (balances[payerId] !== undefined) {
      balances[payerId] += amount;
    }
    
    Object.keys(owedAmounts).forEach(memberId => {
      if (balances[memberId] !== undefined) {
        balances[memberId] -= owedAmounts[memberId];
      }
    });
  });

  // Process all settlements (which reduce debt)
  settlements.forEach(settlement => {
    const { fromId, toId, amount } = settlement;
    // Payer of settlement (fromId) gets their debt reduced (balance increases closer to 0 or becomes positive)
    if (balances[fromId] !== undefined) {
      balances[fromId] += amount;
    }
    // Receiver of settlement (toId) gets their credit reduced (balance decreases closer to 0)
    if (balances[toId] !== undefined) {
      balances[toId] -= amount;
    }
  });

  return balances;
}

/**
 * Greedy graph algorithm to simplify debts.
 * Reduces N transactions into the minimum number of transactions needed.
 */
export function simplifyDebts(members: Member[], balances: { [memberId: string]: number }): Transaction[] {
  // Find members mapping
  const memberMap = new Map<string, Member>();
  members.forEach(m => memberMap.set(m.id, m));

  // Separate debtors and creditors
  interface Account {
    id: string;
    balance: number;
  }

  const debtors: Account[] = [];
  const creditors: Account[] = [];

  Object.entries(balances).forEach(([id, balance]) => {
    // Round to avoid floating point issues (e.g. 0.0000000001)
    const roundedBalance = Math.round(balance * 100) / 100;
    if (roundedBalance < -0.01) {
      debtors.push({ id, balance: roundedBalance });
    } else if (roundedBalance > 0.01) {
      creditors.push({ id, balance: roundedBalance });
    }
  });

  const transactions: Transaction[] = [];

  // Greedy match
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort so we always pick the largest debtor and creditor
    debtors.sort((a, b) => a.balance - b.balance); // Ascending: most negative (largest debt) first
    creditors.sort((a, b) => b.balance - a.balance); // Descending: most positive (largest credit) first

    const maxDebtor = debtors[0];
    const maxCreditor = creditors[0];

    const settleAmount = Math.min(-maxDebtor.balance, maxCreditor.balance);

    // Apply settlement
    maxDebtor.balance += settleAmount;
    maxCreditor.balance -= settleAmount;

    const debtorMember = memberMap.get(maxDebtor.id);
    const creditorMember = memberMap.get(maxCreditor.id);

    if (debtorMember && creditorMember && settleAmount > 0.01) {
      transactions.push({
        fromId: debtorMember.id,
        fromName: debtorMember.name,
        fromUpi: debtorMember.upiId,
        toId: creditorMember.id,
        toName: creditorMember.name,
        toUpi: creditorMember.upiId,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }

    // Remove if settled
    if (Math.abs(maxDebtor.balance) < 0.01) {
      debtors.shift();
    }
    if (Math.abs(maxCreditor.balance) < 0.01) {
      creditors.shift();
    }
  }

  return transactions;
}
