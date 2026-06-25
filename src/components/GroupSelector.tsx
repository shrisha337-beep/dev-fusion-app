import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import tw from 'twrnc';
import { Plus, Users, ArrowRight, Share2 } from 'lucide-react-native';
import { createGroup, joinGroup, loadGroupLocally, getRecentGroupIds, Group } from '../utils/db';

interface GroupSelectorProps {
  onGroupSelected: (group: Group) => void;
}

export default function GroupSelector({ onGroupSelected }: GroupSelectorProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [userName, setUserName] = useState('');
  const [userUpi, setUserUpi] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load recently accessed groups
  useEffect(() => {
    async function loadRecent() {
      try {
        const ids = await getRecentGroupIds();
        const loaded: Group[] = [];
        for (const id of ids) {
          const g = await loadGroupLocally(id);
          if (g) loaded.push(g);
        }
        setRecentGroups(loaded);
      } catch (e) {
        console.error('Failed loading recent groups', e);
      } finally {
        setLoadingRecent(false);
      }
    }
    loadRecent();
  }, []);

  const handleCreate = async () => {
    setErrorMsg('');
    if (!groupName.trim() || !userName.trim() || !userUpi.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    // Basic UPI validation
    if (!userUpi.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g. name@upi).');
      return;
    }

    setSubmitting(true);
    try {
      const g = await createGroup(groupName.trim(), userName.trim(), userUpi.trim());
      onGroupSelected(g);
    } catch (e) {
      setErrorMsg('Failed to create group. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setErrorMsg('');
    if (!inviteCode.trim() || !userName.trim() || !userUpi.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    // Basic UPI validation
    if (!userUpi.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g. name@upi).');
      return;
    }

    setSubmitting(true);
    try {
      const g = await joinGroup(inviteCode.trim(), userName.trim(), userUpi.trim());
      if (g) {
        onGroupSelected(g);
      } else {
        setErrorMsg('Group not found. Double check the invite code.');
      }
    } catch (e) {
      setErrorMsg('Failed to join group. Check connection or code.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={tw`p-6 bg-slate-50 min-h-full`}>
      {/* Branding */}
      <View style={tw`items-center my-6`}>
        <View style={tw`w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center shadow-md mb-3`}>
          <Users color="white" size={32} />
        </View>
        <Text style={tw`text-3xl font-bold text-slate-900`}>SplitSmart</Text>
        <Text style={tw`text-slate-500 text-center mt-1`}>
          Effortless expense splitting with instant UPI settlements
        </Text>
      </View>

      {/* Tabs */}
      <View style={tw`flex-row bg-slate-200 p-1 rounded-xl mb-6`}>
        <TouchableOpacity
          onPress={() => { setActiveTab('create'); setErrorMsg(''); }}
          style={tw`flex-1 py-3 rounded-lg items-center ${activeTab === 'create' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text style={tw`font-semibold ${activeTab === 'create' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Create Group
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setActiveTab('join'); setErrorMsg(''); }}
          style={tw`flex-1 py-3 rounded-lg items-center ${activeTab === 'join' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text style={tw`font-semibold ${activeTab === 'join' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Join Group
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error alert */}
      {errorMsg ? (
        <View style={tw`bg-red-50 border border-red-200 p-3 rounded-xl mb-4`}>
          <Text style={tw`text-red-600 text-sm font-medium`}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Forms */}
      <View style={tw`bg-white p-5 rounded-2xl shadow-sm mb-6 border border-slate-100`}>
        {activeTab === 'create' ? (
          <View>
            <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Group Name</Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g. Goa Trip 2026, Flat 402"
              placeholderTextColor="#94a3b8"
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4`}
            />

            <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Your Name</Text>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#94a3b8"
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4`}
            />

            <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Your UPI ID (for settlements)</Text>
            <TextInput
              value={userUpi}
              onChangeText={setUserUpi}
              placeholder="e.g. rahul@oksbi, 9876543210@paytm"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-6`}
            />

            <TouchableOpacity
              onPress={handleCreate}
              disabled={submitting}
              style={tw`bg-indigo-600 py-3.5 rounded-xl items-center flex-row justify-center`}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={tw`text-white font-bold text-base mr-2`}>Create Group</Text>
                  <Plus color="white" size={18} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Invite Code</Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="6-character code (e.g. ABCD12)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4 font-semibold text-center text-lg`}
            />

            <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Your Name</Text>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              placeholder="e.g. Priya Patel"
              placeholderTextColor="#94a3b8"
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-4`}
            />

            <Text style={tw`text-sm font-bold text-slate-700 mb-1`}>Your UPI ID</Text>
            <TextInput
              value={userUpi}
              onChangeText={setUserUpi}
              placeholder="e.g. priya@okaxis"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              style={tw`border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-slate-50 mb-6`}
            />

            <TouchableOpacity
              onPress={handleJoin}
              disabled={submitting}
              style={tw`bg-indigo-600 py-3.5 rounded-xl items-center flex-row justify-center`}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={tw`text-white font-bold text-base mr-2`}>Join Group</Text>
                  <ArrowRight color="white" size={18} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Recent Groups List */}
      <View style={tw`mb-8`}>
        <Text style={tw`text-lg font-bold text-slate-800 mb-3`}>Recent Groups</Text>
        
        {loadingRecent ? (
          <ActivityIndicator color="#4f46e5" style={tw`my-4`} />
        ) : recentGroups.length === 0 ? (
          <View style={tw`bg-slate-100 border border-dashed border-slate-200 p-6 rounded-2xl items-center`}>
            <Text style={tw`text-slate-400 text-sm`}>No recent groups found.</Text>
          </View>
        ) : (
          recentGroups.map(g => (
            <TouchableOpacity
              key={g.id}
              onPress={() => onGroupSelected(g)}
              style={tw`bg-white p-4 rounded-xl flex-row items-center justify-between mb-3 border border-slate-100 shadow-sm`}
            >
              <View>
                <Text style={tw`font-bold text-slate-800 text-base`}>{g.name}</Text>
                <Text style={tw`text-slate-400 text-xs mt-1`}>
                  {g.members.length} member{g.members.length > 1 ? 's' : ''} • Invite Code: {g.id}
                </Text>
              </View>
              <View style={tw`bg-indigo-50 w-8 h-8 rounded-full items-center justify-center`}>
                <ArrowRight color="#4f46e5" size={16} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
