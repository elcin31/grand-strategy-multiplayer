import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWorldCountry } from '../world/catalog';
import type { GameState, Country } from '../types/game';

export function CountryPicker({ state, onPreview }: { state: GameState; onPreview: (id: string) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ru-RU');
    return Object.values(state.countries).filter(c => {
      const definition = getWorldCountry(c.id);
      return [c.name, c.shortName, c.id, definition?.englishName ?? '', definition?.iso2 ?? ''].some(value => value.toLocaleLowerCase('ru-RU').includes(search));
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [state.countries, query]);
  const occupied = new Set(state.players.map(p => p.countryId).filter(Boolean));
  const renderRow = ({ item }: { item: Country }) => <Pressable accessibilityLabel={'Государство: '+item.name} style={styles.row} onPress={() => { onPreview(item.id); setOpen(false); }}>
    <View style={[styles.swatch, { backgroundColor: item.color }]} />
    <Text style={styles.name}>{item.name}</Text><Text style={styles.code}>{occupied.has(item.id) ? 'ЗАНЯТО' : item.shortName}</Text>
  </Pressable>;
  return <>
    <Pressable style={styles.button} onPress={() => setOpen(true)}><Text style={styles.text}>СТРАНЫ · {Object.keys(state.countries).length}</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.overlay}><View style={styles.dialog}>
        <View style={styles.header}><Text style={styles.title}>ВЫБОР ГОСУДАРСТВА</Text><Pressable onPress={() => setOpen(false)}><Text style={styles.text}>ЗАКРЫТЬ</Text></Pressable></View>
        <TextInput accessibilityLabel="Поиск государства" placeholder="Название или ISO-код" placeholderTextColor="#87968f" autoCorrect={false} value={query} onChangeText={setQuery} style={styles.input} />
        <FlatList data={rows} keyExtractor={c => c.id} renderItem={renderRow} keyboardShouldPersistTaps="handled" initialNumToRender={8} maxToRenderPerBatch={12} windowSize={5} ListEmptyComponent={<Text style={styles.text}>Государства не найдены</Text>} />
      </View></SafeAreaView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: '#17242a', borderColor: '#485953', borderWidth: 1, borderRadius: 5, paddingHorizontal: 12, paddingVertical: 10 },
  text: { color: '#dddcca', fontSize: 11, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: '#030b12bb', alignItems: 'center', justifyContent: 'center' },
  dialog: { height: '90%', width: '70%', maxWidth: 660, backgroundColor: '#17242a', padding: 16, borderRadius: 8, borderColor: '#485953', borderWidth: 1, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#f0ead8', fontWeight: '800', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#485953', backgroundColor: '#101c23', color: '#eee9d8', padding: 10, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#33433e', gap: 12 },
  swatch: { width: 16, height: 16, borderRadius: 3 }, name: { flex: 1, color: '#e4e6dc', fontSize: 13 }, code: { color: '#a1afa4', fontSize: 10 },
});
