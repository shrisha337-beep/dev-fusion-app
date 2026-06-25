import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Group } from './db';
import { calculateBalances, simplifyDebts } from './debtSimplifier';

/**
 * Exports group details and history to a CSV file and opens the sharing dialog.
 */
export async function exportToCSV(group: Group): Promise<void> {
  const balances = calculateBalances(group.members, group.expenses, group.settlements);
  const transactions = simplifyDebts(group.members, balances);

  let csvContent = `SplitSmart Group Report: ${group.name}\n`;
  csvContent += `Invite Code,${group.id}\n`;
  csvContent += `Generated On,${new Date().toLocaleDateString()}\n\n`;

  // 1. Balances Section
  csvContent += `--- GROUP BALANCES ---\n`;
  csvContent += `Member Name,UPI ID,Net Balance (₹)\n`;
  group.members.forEach(m => {
    const bal = balances[m.id] || 0;
    csvContent += `"${m.name}","${m.upiId}",${bal.toFixed(2)}\n`;
  });
  csvContent += `\n`;

  // 2. Simplified Settlements Section
  csvContent += `--- SUGGESTED SETTLEMENTS (DSA Simplified) ---\n`;
  csvContent += `Payer (Owes),Payee (Owed),Amount (₹),Payee UPI\n`;
  if (transactions.length === 0) {
    csvContent += `All settled up!,,,\n`;
  } else {
    transactions.forEach(t => {
      csvContent += `"${t.fromName}","${t.toName}",${t.amount.toFixed(2)},"${t.toUpi}"\n`;
    });
  }
  csvContent += `\n`;

  // 3. Expense Ledger Section
  csvContent += `--- EXPENSE LEDGER ---\n`;
  csvContent += `Date,Description,Category,Payer,Split Type,Amount (₹),Participants & Shares\n`;
  if (group.expenses.length === 0) {
    csvContent += `No expenses logged yet!,,,,,,\n`;
  } else {
    group.expenses.forEach(e => {
      const payerName = group.members.find(m => m.id === e.payerId)?.name || 'Unknown';
      
      // Build share list string
      const details: string[] = [];
      const activeMembers = group.members.filter(m => !e.excludedMemberIds?.includes(m.id));
      activeMembers.forEach(m => {
        const shareVal = e.splits[m.id] || 0;
        details.push(`${m.name}: ${shareVal}`);
      });
      const detailsStr = `"${details.join(' | ')}"`;

      csvContent += `${e.date},"${e.description.replace(/"/g, '""')}",${e.category},"${payerName}",${e.splitType},${e.amount.toFixed(2)},${detailsStr}\n`;
    });
  }
  csvContent += `\n`;

  // 4. Settlements Log Section
  csvContent += `--- SETTLEMENT LOG ---\n`;
  csvContent += `Date,From (Payer),To (Payee),Amount (₹),Status\n`;
  if (group.settlements.length === 0) {
    csvContent += `No settlements recorded yet!,,,,\n`;
  } else {
    group.settlements.forEach(s => {
      const fromName = group.members.find(m => m.id === s.fromId)?.name || 'Unknown';
      const toName = group.members.find(m => m.id === s.toId)?.name || 'Unknown';
      csvContent += `${s.date},"${fromName}","${toName}",${s.amount.toFixed(2)},${s.status}\n`;
    });
  }

  // Write file to device cache and share
  const fileUri = `${FileSystem.cacheDirectory}SplitSmart_${group.name.replace(/\s+/g, '_')}_ledger.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export SplitSmart CSV`,
    });
  } else {
    alert('Sharing is not available on this device');
  }
}

/**
 * Exports group details and history to a printable PDF document.
 */
export async function exportToPDF(group: Group): Promise<void> {
  const balances = calculateBalances(group.members, group.expenses, group.settlements);
  const transactions = simplifyDebts(group.members, balances);

  // Generate HTML template
  let membersHtml = '';
  group.members.forEach(m => {
    const bal = balances[m.id] || 0;
    const balClass = bal > 0 ? 'text-green' : bal < 0 ? 'text-red' : 'text-slate';
    const sign = bal > 0 ? '+' : '';
    membersHtml += `
      <tr>
        <td>${m.name}</td>
        <td>${m.upiId}</td>
        <td class="font-bold ${balClass}">${sign}₹${bal.toFixed(2)}</td>
      </tr>
    `;
  });

  let settlementsHtml = '';
  if (transactions.length === 0) {
    settlementsHtml = '<tr><td colspan="4" class="text-center text-slate">All settled up! No transactions needed.</td></tr>';
  } else {
    transactions.forEach(t => {
      settlementsHtml += `
        <tr>
          <td><strong>${t.fromName}</strong></td>
          <td class="text-red">owes</td>
          <td><strong>${t.toName}</strong></td>
          <td class="font-bold">₹${t.amount.toFixed(2)}</td>
        </tr>
      `;
    });
  }

  let expensesHtml = '';
  if (group.expenses.length === 0) {
    expensesHtml = '<tr><td colspan="6" class="text-center text-slate">No expenses logged yet.</td></tr>';
  } else {
    group.expenses.forEach(e => {
      const payerName = group.members.find(m => m.id === e.payerId)?.name || 'Unknown';
      expensesHtml += `
        <tr>
          <td>${e.date}</td>
          <td>${e.description}</td>
          <td><span class="badge badge-${e.category}">${e.category}</span></td>
          <td>${payerName}</td>
          <td class="text-capitalize">${e.splitType}</td>
          <td class="font-bold">₹${e.amount.toFixed(2)}</td>
        </tr>
      `;
    });
  }

  let logHtml = '';
  if (group.settlements.length === 0) {
    logHtml = '<tr><td colspan="5" class="text-center text-slate">No settlements recorded yet.</td></tr>';
  } else {
    group.settlements.forEach(s => {
      const fromName = group.members.find(m => m.id === s.fromId)?.name || 'Unknown';
      const toName = group.members.find(m => m.id === s.toId)?.name || 'Unknown';
      logHtml += `
        <tr>
          <td>${s.date}</td>
          <td>${fromName}</td>
          <td>${toName}</td>
          <td class="font-bold">₹${s.amount.toFixed(2)}</td>
          <td><span class="badge badge-${s.status === 'settled' ? 'rent' : 'entertainment'}">${s.status}</span></td>
        </tr>
      `;
    });
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>SplitSmart Report</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            line-height: 1.5;
            padding: 20px;
          }
          h1 {
            color: #4f46e5;
            margin-bottom: 5px;
            font-size: 28px;
          }
          h2 {
            color: #1e293b;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 6px;
            margin-top: 30px;
            font-size: 18px;
          }
          .subtitle {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 600;
            text-align: left;
            border-bottom: 2px solid #e2e8f0;
          }
          th, td {
            padding: 10px 12px;
            font-size: 13px;
          }
          tr {
            border-bottom: 1px solid #f1f5f9;
          }
          .text-green { color: #16a34a; }
          .text-red { color: #dc2626; }
          .text-slate { color: #64748b; }
          .font-bold { font-weight: bold; }
          .text-capitalize { text-transform: capitalize; }
          .text-center { text-align: center; }
          .badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 9999px;
            font-weight: 500;
            text-transform: uppercase;
          }
          .badge-food { background-color: #ffedd5; color: #ea580c; }
          .badge-travel { background-color: #e0f2fe; color: #0284c7; }
          .badge-rent { background-color: #dcfce7; color: #16a34a; }
          .badge-utilities { background-color: #f3e8ff; color: #9333ea; }
          .badge-entertainment { background-color: #fce7f3; color: #db2777; }
          .badge-other { background-color: #f1f5f9; color: #475569; }
          .badge-settled { background-color: #dcfce7; color: #16a34a; }
          .badge-pending { background-color: #fef9c3; color: #ca8a04; }
          
          /* Footer styling */
          .footer {
            margin-top: 40px;
            font-size: 11px;
            text-align: center;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <h1>SplitSmart</h1>
        <div class="subtitle">
          Group Ledger Report: <strong>${group.name}</strong><br/>
          Invite Code: <strong>${group.id}</strong> | Generated on: ${new Date().toLocaleDateString()}
        </div>

        <h2>Group Members & Net Balances</h2>
        <table>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>UPI ID</th>
              <th>Net Balance</th>
            </tr>
          </thead>
          <tbody>
            ${membersHtml}
          </tbody>
        </table>

        <h2>Simplified Settlements Required (DSA Engine)</h2>
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Action</th>
              <th>To</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${settlementsHtml}
          </tbody>
        </table>

        <h2>Expense Ledger History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Paid By</th>
              <th>Split Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expensesHtml}
          </tbody>
        </table>

        <h2>Recorded Settlements</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${logHtml}
          </tbody>
        </table>

        <div class="footer">
          Generated via SplitSmart App - Effortless group expense splitting for college students.
        </div>
      </body>
    </html>
  `;

  // Print to file (PDF)
  const { uri } = await Print.printToFileAsync({ html });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share SplitSmart PDF Report',
    });
  } else {
    alert('Sharing is not available on this device');
  }
}
