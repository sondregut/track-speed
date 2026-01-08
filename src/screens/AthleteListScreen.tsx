import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../contexts';
import { spacing, typography, borderRadius } from '../constants/theme';
import { Header, Button, Card, GlassCard, IconButton } from '../components/ui';
import { useSessionStore } from '../stores';
import { Athlete } from '../types';
import { formatTime } from '../utils/timing';

interface AthleteListScreenProps {
  selectionMode?: boolean;
  onSelect?: (athlete: Athlete) => void;
}

export function AthleteListScreen({ selectionMode = false, onSelect }: AthleteListScreenProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    athletes,
    selectedAthleteId,
    addAthlete,
    updateAthlete,
    deleteAthlete,
    selectAthlete,
  } = useSessionStore();

  // Use Glass UI on iOS 26+ (adapts to light/dark via tintColor)
  const useGlassUI = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const AthleteCard = useGlassUI ? GlassCard : Card;

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState('');

  const handleAddAthlete = () => {
    if (!newName.trim()) return;

    addAthlete({
      name: newName.trim(),
      team: newTeam.trim() || undefined,
    });

    setNewName('');
    setNewTeam('');
    setShowAddModal(false);
  };

  const handleUpdateAthlete = () => {
    if (!editingAthlete || !newName.trim()) return;

    updateAthlete(editingAthlete.id, {
      name: newName.trim(),
      team: newTeam.trim() || undefined,
    });

    setEditingAthlete(null);
    setNewName('');
    setNewTeam('');
  };

  const handleSelectAthlete = (athlete: Athlete) => {
    if (selectionMode && onSelect) {
      onSelect(athlete);
      router.back();
    } else {
      selectAthlete(athlete.id);
    }
  };

  const openEditModal = (athlete: Athlete) => {
    setEditingAthlete(athlete);
    setNewName(athlete.name);
    setNewTeam(athlete.team || '');
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingAthlete(null);
    setNewName('');
    setNewTeam('');
  };

  const renderAthlete = ({ item }: { item: Athlete }) => {
    const isSelected = item.id === selectedAthleteId;
    const bestTime = item.personalBests?.[100]; // Show 100m PB

    return (
      <TouchableOpacity
        onPress={() => handleSelectAthlete(item)}
        onLongPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <AthleteCard
          variant={isSelected ? 'elevated' : 'default'}
          style={[styles.athleteCard, isSelected && { borderWidth: 2, borderColor: colors.primary[500] }]}
        >
          <View style={styles.athleteInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
              <Text style={[styles.avatarText, { color: colors.white }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.athleteDetails}>
              <Text style={[styles.athleteName, { color: colors.text.primary }]}>{item.name}</Text>
              {item.team && <Text style={[styles.athleteTeam, { color: colors.text.secondary }]}>{item.team}</Text>}
            </View>
          </View>

          <View style={styles.athleteStats}>
            {bestTime && (
              <View style={styles.pbContainer}>
                <Text style={[styles.pbLabel, { color: colors.text.secondary }]}>100m PB</Text>
                <Text style={[styles.pbValue, { color: colors.primary[600] }]}>{formatTime(bestTime)}s</Text>
              </View>
            )}
            {isSelected && (
              <View style={[styles.selectedBadge, { backgroundColor: colors.primary[500] }]}>
                <Text style={[styles.selectedText, { color: colors.white }]}>Selected</Text>
              </View>
            )}
          </View>
        </AthleteCard>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No Athletes</Text>
      <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
        Add athletes to track their times and personal bests.
      </Text>
      <Button
        title="Add First Athlete"
        onPress={() => setShowAddModal(true)}
        style={styles.emptyButton}
      />
    </View>
  );

  const renderModal = () => (
    <Modal
      visible={showAddModal || editingAthlete !== null}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeModal}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.card.background }]}>
          <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
            {editingAthlete ? 'Edit Athlete' : 'Add Athlete'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary, borderColor: colors.border.primary }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Athlete name"
              placeholderTextColor={colors.text.tertiary}
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Team (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary, borderColor: colors.border.primary }]}
              value={newTeam}
              onChangeText={setNewTeam}
              placeholder="Team or club name"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <View style={styles.modalActions}>
            {editingAthlete && (
              <Button
                title="Delete"
                variant="danger"
                onPress={() => {
                  deleteAthlete(editingAthlete.id);
                  closeModal();
                }}
              />
            )}
            <View style={styles.modalButtonGroup}>
              <Button title="Cancel" variant="ghost" onPress={closeModal} />
              <Button
                title={editingAthlete ? 'Save' : 'Add'}
                onPress={editingAthlete ? handleUpdateAthlete : handleAddAthlete}
                disabled={!newName.trim()}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Header
        title={selectionMode ? 'Select Athlete' : 'Athletes'}
        leftAction={
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary[500] }]}>Back</Text>
          </TouchableOpacity>
        }
        rightAction={
          !selectionMode && (
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Text style={[styles.addText, { color: colors.primary[500] }]}>+ Add</Text>
            </TouchableOpacity>
          )
        }
      />

      {selectionMode && (
        <TouchableOpacity
          style={[styles.noAthleteOption, { borderBottomColor: colors.border.primary }]}
          onPress={() => {
            selectAthlete(null);
            router.back();
          }}
        >
          <Text style={[styles.noAthleteText, { color: colors.text.secondary }]}>Continue without athlete</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={athletes}
        renderItem={renderAthlete}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          athletes.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backText: {
    fontSize: typography.fontSize.base,
  },
  addText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  noAthleteOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  noAthleteText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 40,
  },
  emptyList: {
    flex: 1,
  },
  athleteCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  athleteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
  },
  athleteDetails: {
    gap: 2,
  },
  athleteName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  athleteTeam: {
    fontSize: typography.fontSize.sm,
  },
  athleteStats: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  pbContainer: {
    alignItems: 'flex-end',
  },
  pbLabel: {
    fontSize: typography.fontSize.xs,
  },
  pbValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as '600',
    fontVariant: ['tabular-nums'],
  },
  selectedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  selectedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as '600',
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
  },
  modalActions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
