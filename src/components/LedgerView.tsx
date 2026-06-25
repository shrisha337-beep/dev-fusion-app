import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Modal, Alert } from 'react-native';
import tw from 'twrnc';
import { Check, X, ArrowRight, DollarSign, Info } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Member, Expense, Settlement, Transaction, calculateBalances, simplifyDebts } from '../utils/debtSimplifier';
import { Group } from '../utils/db';

interface LedgerViewProps {
  group: Group;
  currentMemberId: string | null;
  onAddSettlement: (settlement: Omit<Settlement, 'id' | 'date'>) => void;
  onConfirmSettlement: (settlementId: string) => void;
  onDeclineSettlement: (settlementId: string) => void;
}

export default function LedgerView({
  group,
  currentMemberId,
  onAddSettlement,
  onConfirmSettlement,
  onDeclineSettlement,
}: LedgerViewProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const balances = calculateBalances(group.members, group.expenses, group.settlements);
  const simplifiedTransactions = simplifyDebts(group.members, balances);
  const memberMap = new Map<string, Member>();
  group.members.forEach(m => memberMap.set(m.id, m));

  const handleSettleUpPress = (tx: Transaction) => {
    setSelectedTx(tx);
    setModalVisible(true);
  };

  // Launch UPI intent
  const triggerUpiPayment = async (tx: Transaction) => {
    if (!tx.toUpi) {
      Alert.alert('Error', 'Recipient does not have a UPI ID registered.');
      return;
    }

    // Format UPI payment intent URI
    // pa = payee VPA, pn = payee name, am = amount, cu = currency, tn = transaction note
    const upiUrl = `upi://pay?pa=${encodeURIComponent(tx.toUpi)}&pn=${encodeURIComponent(tx.toName)}&am=${tx.amount.toFixed(2)}&cu=INR&tn=SplitSmart%20Settle%20Up`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        // Fallback for emulators/desktop testing
        Alert.alert(
          'UPI Apps Not Found',
          'We couldn\'t find any UPI apps on this device. You can scan the QR code on-screen instead, or mark this as settled if you paid via another app.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      console.warn('UPI Link opening error:', e);
      Alert.alert('Payment Error', 'Failed to launch payment apps. Please use the QR code.');
    }
  };

  const handleMarkAsPaid = () => {
    if (!selectedTx) return;
    
    // Log a pending settlement
    onAddSettlement({
      fromId: selectedTx.fromId,
      toId: selectedTx.toId,
      amount: selectedTx.amount,
      status: 'pending',
    });

    setModalVisible(false);
    setSelectedTx(null);
    Alert.alert(
      'Settlement Logged',
      `Sent settlement request to ${selectedTx.toName}. They will need to confirm receipt of ₹${selectedTx.amount} inside their app.`,
      [{ text: 'Got it' }]
    );
  };

  // Get pending settlements for confirmation notifications
  const pendingSettlements = group.settlements.filter(s => s.status === 'pending');

  return (
    <ScrollView contentContainerStyle={tw`p-5 bg-slate-50 min-h-full pb-16`}>
      {/* 1. Pending Notifications Section */}
      {pendingSettlements.length > 0 && (
        <View style={tw`mb-5`}>
          <Text style={tw`text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider`}>Pending Confirmations</Text>
          {pendingSettlements.map(s => {
            const payerName = memberMap.get(s.fromId)?.name || 'Unknown';
            const payeeName = memberMap.get(s.toId)?.name || 'Unknown';
            
            const isPayer = s.fromId === currentMemberId;
            const isPayee = s.toId === currentMemberId;

            return (
              <View
                key={s.id}
                style={tw`bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-2 flex-row items-center justify-between shadow-xs`}
              >
                <View style={tw`flex-1 pr-3`}>
                  <Text style={tw`text-slate-800 text-sm font-semibold`}>
                    {isPayer ? `You paid ${payeeName}` : isPayee ? `${payerName} paid you` : `${payerName} paid ${payeeName}`}
                  </Text>
                  <Text style={tw`text-slate-900 font-bold text-base mt-0.5`}>₹{s.amount.toFixed(2)}</Text>
                  <Text style={tw`text-indigo-500 text-xs mt-1 font-medium`}>
                    {isPayee ? 'Confirm that you received the payment' : 'Waiting for recipient to confirm...'}
                  </Text>
                </View>
                
                {isPayee ? (
                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      onPress={() => onDeclineSettlement(s.id)}
                      style={tw`w-9 h-9 bg-red-100 rounded-full items-center justify-center mr-2`}
                    >
                      <X color="#dc2626" size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onConfirmSettlement(s.id)}
                      style={tw`w-9 h-9 bg-green-100 rounded-full items-center justify-center`}
                    >
                      <Check color="#16a34a" size={18} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={tw`bg-indigo-100 px-3 py-1.5 rounded-full`}>
                    <Text style={tw`text-indigo-700 text-xs font-bold`}>Pending</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 2. Group Balances Grid */}
      <View style={tw`mb-6`}>
        <Text style={tw`text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider`}>Member Balances</Text>
        <View style={tw`flex-row flex-wrap justify-between`}>
          {group.members.map(m => {
            const bal = balances[m.id] || 0;
            const isOwed = bal > 0.01;
            const owes = bal < -0.01;
            const cardBg = isOwed ? 'bg-emerald-50 border-emerald-100' : owes ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200';
            const textClass = isOwed ? 'text-green-600' : owes ? 'text-red-600' : 'text-slate-500';
            const isCurrentUser = m.id === currentMemberId;

            return (
              <View
                key={m.id}
                style={tw`w-[48%] p-3.5 rounded-2xl border ${cardBg} mb-3.5 shadow-sm`}
              >
                <Text style={tw`font-bold text-slate-800 text-sm`} numberOfLines={1}>
                  {m.name} {isCurrentUser ? '(You)' : ''}
                </Text>
                <Text style={tw`text-xs text-slate-400 mt-0.5`} numberOfLines={1}>{m.upiId}</Text>
                
                <Text style={tw`text-lg font-extrabold mt-2.5 ${textClass}`}>
                  {bal > 0.01 ? `+₹${bal.toFixed(2)}` : bal < -0.01 ? `-₹${Math.abs(bal).toFixed(2)}` : '₹0.00'}
                </Text>
                <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5`}>
                  {bal > 0.01 ? 'is owed' : bal < -0.01 ? 'owes' : 'settled'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 3. Debt Simplification Panel */}
      <View style={tw`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm`}>
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <Text style={tw`text-lg font-bold text-slate-800`}>Smart Settlements</Text>
          <View style={tw`bg-indigo-50 px-3 py-1 rounded-full flex-row items-center`}>
            <Info size={12} color="#4f46e5" style={tw`mr-1`} />
            <Text style={tw`text-indigo-600 text-[10px] font-extrabold uppercase tracking-wider`}>DSA Optimized</Text>
          </View>
        </View>

        {simplifiedTransactions.length === 0 ? (
          <View style={tw`items-center py-6 bg-slate-50 rounded-xl border border-slate-100`}>
            <Text style={tw`text-slate-400 text-sm font-semibold`}>🎉 Everyone is settled up!</Text>
            <Text style={tw`text-slate-400 text-xs mt-1`}>No payments are pending in this group.</Text>
          </View>
        ) : (
          simplifiedTransactions.map((tx, idx) => {
            const isUserDebtor = tx.fromId === currentMemberId;
            return (
              <View
                key={idx}
                style={tw`flex-row items-center justify-between py-3 border-b border-slate-100 last:border-b-0`}
              >
                <View style={tw`flex-row items-center flex-1 pr-3`}>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-bold text-slate-800 text-sm`}>{tx.fromName}</Text>
                    <Text style={tw`text-slate-400 text-xs`}>owes {tx.toName}</Text>
                  </View>
                  <ArrowRight color="#94a3b8" size={16} style={tw`mx-2`} />
                  <Text style={tw`font-extrabold text-slate-800 text-base`}>₹{tx.amount.toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleSettleUpPress(tx)}
                  style={tw`px-4 py-2 rounded-xl border ${isUserDebtor ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}
                >
                  <Text style={tw`text-xs font-extrabold uppercase tracking-wider ${isUserDebtor ? 'text-white' : 'text-indigo-600'}`}>
                    Settle Up
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* Settle Up Details Modal */}
      {selectedTx && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={tw`flex-1 justify-end bg-black/50`}>
            <View style={tw`bg-white rounded-t-3xl p-6 shadow-xl`}>
              <View style={tw`flex-row justify-between items-center mb-5`}>
                <Text style={tw`text-xl font-bold text-slate-800`}>Settle Up Payment</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={tw`bg-slate-100 p-2 rounded-full`}>
                  <X color="#475569" size={18} />
                </TouchableOpacity>
              </View>

              {/* Settlement Summary */}
              <View style={tw`bg-slate-50 p-5 rounded-2xl items-center mb-5 border border-slate-100`}>
                <Text style={tw`text-slate-500 font-medium text-sm`}>
                  {selectedTx.fromName} owes {selectedTx.toName}
                </Text>
                <Text style={tw`text-3xl font-extrabold text-slate-900 mt-2`}>₹{selectedTx.amount.toFixed(2)}</Text>
                <Text style={tw`text-slate-400 text-xs mt-1.5`}>Payee UPI: {selectedTx.toUpi}</Text>
              </View>

              {/* Actions */}
              <View style={tw`items-center`}>
                {/* 1. UPI Payment Direct Link */}
                <TouchableOpacity
                  onPress={() => triggerUpiPayment(selectedTx)}
                  style={tw`bg-indigo-600 w-full py-4 rounded-xl items-center flex-row justify-center mb-4`}
                >
                  <DollarSign color="white" size={18} style={tw`mr-2`} />
                  <Text style={tw`text-white font-bold text-base`}>Pay via UPI Apps</Text>
                </TouchableOpacity>

                {/* 2. QR Code Render for scan to pay */}
                {selectedTx.toUpi ? (
                  <View style={tw`items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-xs mb-5`}>
                    <QRCode
                      value={`upi://pay?pa=${selectedTx.toUpi}&pn=${selectedTx.toName}&am=${selectedTx.amount.toFixed(2)}&cu=INR&tn=SplitSmart`}
                      size={150}
                    />
                    <Text style={tw`text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-2.5`}>
                      Scan QR with any UPI App
                    </Text>
                  </View>
                ) : null}

                {/* 3. Mark as Settled manually (triggers approval check) */}
                <TouchableOpacity
                  onPress={handleMarkAsPaid}
                  style={tw`bg-slate-100 w-full py-3.5 rounded-xl items-center border border-slate-200`}
                >
                  <Text style={tw`text-slate-700 font-bold text-sm`}>Mark as Paid (Awaiting Confirmation)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}
