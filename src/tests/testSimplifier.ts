import { calculateBalances, simplifyDebts, Member, Expense, Settlement } from '../utils/debtSimplifier';
declare var process: any;

// Mock data
const members: Member[] = [
  { id: '1', name: 'Rahul', upiId: 'rahul@upi' },
  { id: '2', name: 'Priya', upiId: 'priya@upi' },
  { id: '3', name: 'Amit', upiId: 'amit@upi' },
  { id: '4', name: 'Sneha', upiId: 'sneha@upi' },
];

const expenses: Expense[] = [
  // Rahul paid 1000, split equally among Rahul, Priya, Amit, Sneha (each owes 250)
  // Net diff: Rahul (+750), Priya (-250), Amit (-250), Sneha (-250)
  {
    id: 'e1',
    description: 'Swiggy Dinner',
    amount: 1000,
    payerId: '1',
    category: 'food',
    date: '2026-06-24',
    splitType: 'equal',
    splits: {},
  },
  // Priya paid 500, split by shares: Amit (3 shares), Sneha (2 shares), Rahul/Priya excluded
  // Total shares = 5. Amit owes 300, Sneha owes 200.
  // Net diff: Priya (+500), Amit (-300), Sneha (-200)
  {
    id: 'e2',
    description: 'Cab Trip',
    amount: 500,
    payerId: '2',
    category: 'travel',
    date: '2026-06-24',
    splitType: 'shares',
    splits: { '3': 3, '4': 2 },
    excludedMemberIds: ['1', '2'],
  },
  // Amit paid 100, split by exact amount: Rahul owes 40, Priya owes 60
  // Net diff: Amit (+100), Rahul (-40), Priya (-60)
  {
    id: 'e3',
    description: 'Snacks',
    amount: 100,
    payerId: '3',
    category: 'food',
    date: '2026-06-24',
    splitType: 'exact',
    splits: { '1': 40, '2': 60 },
  }
];

const settlements: Settlement[] = [
  // Amit settled 100 to Rahul
  // Net balance adjustments: Amit (+100), Rahul (-100)
  {
    id: 's1',
    fromId: '3',
    toId: '1',
    amount: 100,
    status: 'settled',
    date: '2026-06-24',
  }
];

console.log('--- RUNNING BALANCES TEST ---');
const balances = calculateBalances(members, expenses, settlements);
console.log('Calculated Balances:', balances);

// Expected calculations:
// Rahul: +750 (e1) - 40 (e3) - 100 (s1) = +610
// Priya: -250 (e1) + 500 (e2) - 60 (e3) = +190
// Amit: -250 (e1) - 300 (e2) + 100 (e3) + 100 (s1) = -350
// Sneha: -250 (e1) - 200 (e2) = -450
// Sum of net balances must be 0: 610 + 190 - 350 - 450 = 0.
const totalSum = Object.values(balances).reduce((sum, val) => sum + val, 0);
console.log(`Sum of balances (should be 0): ${totalSum}`);

if (Math.abs(totalSum) > 0.001) {
  console.error('FAIL: Balances do not sum to 0!');
  process.exit(1);
}

if (balances['1'] !== 610 || balances['2'] !== 190 || balances['3'] !== -350 || balances['4'] !== -450) {
  console.error('FAIL: Balances calculation is incorrect!');
  process.exit(1);
}
console.log('SUCCESS: Balances test passed!');

console.log('\n--- RUNNING DEBT SIMPLIFICATION TEST ---');
const transactions = simplifyDebts(members, balances);
console.log('Simplified Transactions:', transactions);

// Debts:
// Amit owes 350, Sneha owes 450
// Rahul is owed 610, Priya is owed 190
// Simplified output should be:
// Sneha pays Rahul 450 (Rahul balance becomes 160, Sneha settled)
// Amit pays Rahul 160 (Rahul settled, Amit owes 190)
// Amit pays Priya 190 (Priya settled, Amit settled)
// Verify total payments = 450 + 160 + 190 = 800.
// Verify the simplified transaction list contains exactly 3 transactions:
console.log(`Number of transactions (should be 3): ${transactions.length}`);
if (transactions.length !== 3) {
  console.error(`FAIL: Expected 3 transactions, got ${transactions.length}`);
  process.exit(1);
}

const totalAmountTransacted = transactions.reduce((sum, tx) => sum + tx.amount, 0);
console.log(`Total amount transacted (should be 800): ${totalAmountTransacted}`);
if (totalAmountTransacted !== 800) {
  console.error(`FAIL: Expected 800 transacted, got ${totalAmountTransacted}`);
  process.exit(1);
}

// Verify details
const tx1 = transactions.find(t => t.fromId === '4' && t.toId === '1'); // Sneha to Rahul
const tx2 = transactions.find(t => t.fromId === '3' && t.toId === '1'); // Amit to Rahul
const tx3 = transactions.find(t => t.fromId === '3' && t.toId === '2'); // Amit to Priya

if (!tx1 || tx1.amount !== 450) {
  console.error('FAIL: Sneha to Rahul transaction incorrect!');
  process.exit(1);
}
if (!tx2 || tx2.amount !== 160) {
  console.error('FAIL: Amit to Rahul transaction incorrect!');
  process.exit(1);
}
if (!tx3 || tx3.amount !== 190) {
  console.error('FAIL: Amit to Priya transaction incorrect!');
  process.exit(1);
}

console.log('SUCCESS: Debt simplification test passed!');
console.log('\nALL DSA TESTS PASSED SUCCESSFULLY! 🎉');
