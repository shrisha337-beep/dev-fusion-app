import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { Member, Expense, Settlement } from './debtSimplifier';

export interface RecurringExpenseRule {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  category: 'food' | 'travel' | 'rent' | 'utilities' | 'entertainment' | 'other';
  splitType: 'equal' | 'percentage' | 'exact' | 'shares';
  splits: { [memberId: string]: number };
  excludedMemberIds?: string[];
  frequency: 'weekly' | 'monthly';
  dayOfMonth?: number; // 1-31 (for monthly)
  dayOfWeek?: number; // 0-6 (0 is Sunday, for weekly)
  lastTriggeredDate?: string; // YYYY-MM-DD
}

export interface Group {
  id: string; // Used as the unique invite code (e.g. "ABCD12")
  name: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  recurringExpenses: RecurringExpenseRule[];
  createdAt: string;
}

const STORAGE_GROUPS_KEY = '@SplitSmart:groups';
const STORAGE_RECENT_KEY = '@SplitSmart:recent_groups';

// Helper to generate a 6-character unique invite code/id
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Gets the list of recently accessed group IDs from AsyncStorage
 */
export async function getRecentGroupIds(): Promise<string[]> {
  try {
    const listStr = await AsyncStorage.getItem(STORAGE_RECENT_KEY);
    return listStr ? JSON.parse(listStr) : [];
  } catch (e) {
    console.error('Failed to load recent group IDs', e);
    return [];
  }
}

/**
 * Saves a group ID to the recently accessed list
 */
export async function addRecentGroupId(groupId: string): Promise<void> {
  try {
    const current = await getRecentGroupIds();
    const updated = [groupId, ...current.filter(id => id !== groupId)].slice(0, 10); // keep last 10
    await AsyncStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save recent group ID', e);
  }
}

/**
 * Saves group data to AsyncStorage
 */
export async function saveGroupLocally(group: Group): Promise<void> {
  try {
    const groupsStr = await AsyncStorage.getItem(STORAGE_GROUPS_KEY);
    const groups: { [id: string]: Group } = groupsStr ? JSON.parse(groupsStr) : {};
    groups[group.id] = group;
    await AsyncStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save group locally', e);
  }
}

/**
 * Loads group data from AsyncStorage
 */
export async function loadGroupLocally(groupId: string): Promise<Group | null> {
  try {
    const groupsStr = await AsyncStorage.getItem(STORAGE_GROUPS_KEY);
    const groups: { [id: string]: Group } = groupsStr ? JSON.parse(groupsStr) : {};
    return groups[groupId] || null;
  } catch (e) {
    console.error('Failed to load group locally', e);
    return null;
  }
}

/**
 * Saves a group (both locally and to Firestore)
 */
export async function saveGroup(group: Group): Promise<void> {
  // 1. Save locally
  await saveGroupLocally(group);
  await addRecentGroupId(group.id);

  // 2. Save to Firestore if available
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'groups', group.id);
      await setDoc(docRef, group);
    } catch (e) {
      console.warn('Failed to sync group to Firebase (offline?)', e);
    }
  }
}

/**
 * Creates a brand new group with a unique invite code
 */
export async function createGroup(name: string, creatorName: string, creatorUpi: string): Promise<Group> {
  const inviteCode = generateInviteCode();
  const creator: Member = {
    id: 'm-' + Date.now().toString(),
    name: creatorName,
    upiId: creatorUpi,
  };

  const newGroup: Group = {
    id: inviteCode,
    name,
    members: [creator],
    expenses: [],
    settlements: [],
    recurringExpenses: [],
    createdAt: new Date().toISOString(),
  };

  await saveGroup(newGroup);
  return newGroup;
}

/**
 * Subscribes to group updates in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeToGroup(
  groupId: string,
  onUpdate: (group: Group | null) => void
): () => void {
  let unsubscribing = false;

  // 1. Load local cache immediately for instant render
  loadGroupLocally(groupId).then(localGroup => {
    if (!unsubscribing && localGroup) {
      onUpdate(localGroup);
    }
  });

  // 2. Subscribe to Firebase Firestore real-time doc updates if active
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'groups', groupId);
    const unsub = onSnapshot(docRef, docSnap => {
      if (docSnap.exists()) {
        const groupData = docSnap.data() as Group;
        saveGroupLocally(groupData); // Cache it locally
        addRecentGroupId(groupId);
        onUpdate(groupData);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.warn('Firestore snapshot error (running offline?)', error);
    });

    return () => {
      unsubscribing = true;
      unsub();
    };
  }

  // Fallback: If no Firebase, return a dummy cleanup
  return () => {
    unsubscribing = true;
  };
}

/**
 * Attempts to join an existing group via its invite code.
 * Fetches from Firestore or checks local cache.
 */
export async function joinGroup(inviteCode: string, userName: string, userUpi: string): Promise<Group | null> {
  const code = inviteCode.toUpperCase().trim();
  let group: Group | null = null;

  // 1. Try to fetch from Firebase
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'groups', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        group = docSnap.data() as Group;
      }
    } catch (e) {
      console.warn('Failed to fetch group from Firebase while joining', e);
    }
  }

  // 2. Fallback to checking local cache if Firebase didn't return
  if (!group) {
    group = await loadGroupLocally(code);
  }

  // 3. If group exists, add the new user and save
  if (group) {
    // Check if user is already a member
    const alreadyMember = group.members.some(
      m => m.name.toLowerCase() === userName.toLowerCase() || m.upiId === userUpi
    );

    if (!alreadyMember) {
      const newMember: Member = {
        id: 'm-' + Date.now().toString(),
        name: userName,
        upiId: userUpi,
      };
      group.members.push(newMember);
      await saveGroup(group);
    } else {
      // Just mark it as recent since they are already in the group
      await addRecentGroupId(group.id);
    }
    return group;
  }

  return null;
}
