import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Sun, Moon, Volume2, VolumeX, Save, X } from 'lucide-react';
import { useTally } from '../context/TallyContext';
import { TargetWord } from '../context/TallyContext';

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useTally();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState({
    word: '',
    homophones: [''],
    color: '#3b82f6'
  });

  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.word.trim()) return;

    const filteredHomophones = newWord.homophones.filter(h => h.trim() !== '');
    
    dispatch({
      type: 'ADD_TARGET_WORD',
      payload: {
        word: newWord.word.trim().toLowerCase(),
        homophones: filteredHomophones.map(h => h.trim().toLowerCase()),
        color: newWord.color
      }
    });

    setNewWord({ word: '', homophones: [''], color: '#3b82f6' });
    setShowAddForm(false);
  };

  const handleRemoveWord = (wordId: string) => {
    dispatch({ type: 'REMOVE_TARGET_WORD', payload: wordId });
  };

  const handleUpdateSettings = (updates: Partial<typeof state.settings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: updates });
  };

  const addHomophoneField = () => {
    setNewWord(prev => ({
      ...prev,
      homophones: [...prev.homophones, '']
    }));
  };

  const updateHomophone = (index: number, value: string) => {
    setNewWord(prev => ({
      ...prev,
      homophones: prev.homophones.map((h, i) => i === index ? value : h)
    }));
  };

  const removeHomophone = (index: number) => {
    if (newWord.homophones.length > 1) {
      setNewWord(prev => ({
        ...prev,
        homophones: prev.homophones.filter((_, i) => i !== index)
      }));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your target words and application preferences
        </p>
      </motion.div>

      <div className="space-y-8">
        {/* App Settings */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-semibold text-card-foreground mb-4">
            Application Settings
          </h2>
          
          <div className="space-y-4">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-card-foreground">Theme</label>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <motion.button
                onClick={() => handleUpdateSettings({ 
                  theme: state.settings.theme === 'light' ? 'dark' : 'light' 
                })}
                className="p-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {state.settings.theme === 'light' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </motion.button>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-card-foreground">Sound Feedback</label>
                <p className="text-sm text-muted-foreground">
                  Play sound when words are detected
                </p>
              </div>
              <motion.button
                onClick={() => handleUpdateSettings({ 
                  soundEnabled: !state.settings.soundEnabled 
                })}
                className="p-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {state.settings.soundEnabled ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )}
              </motion.button>
            </div>

            {/* Confidence Threshold */}
            <div>
              <label className="font-medium text-card-foreground block mb-2">
                Confidence Threshold: {Math.round(state.settings.confidenceThreshold * 100)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.1"
                value={state.settings.confidenceThreshold}
                onChange={(e) => handleUpdateSettings({ 
                  confidenceThreshold: parseFloat(e.target.value) 
                })}
                className="w-full accent-primary"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Higher values require more confident speech recognition
              </p>
            </div>
          </div>
        </motion.div>

        {/* Target Words */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-card-foreground">
              Target Words
            </h2>
            <motion.button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors duration-200 flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="h-4 w-4" />
              <span>Add Word</span>
            </motion.button>
          </div>

          {/* Existing Words */}
          <div className="space-y-4 mb-6">
            <AnimatePresence>
              {state.targetWords.map((word, index) => (
                <motion.div
                  key={word.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: word.color }}
                    />
                    <div>
                      <h3 className="font-medium text-card-foreground">
                        {word.word}
                      </h3>
                      {word.homophones.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Also: {word.homophones.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <motion.button
                    onClick={() => handleRemoveWord(word.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add Word Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                onSubmit={handleAddWord}
                className="border-t border-border pt-6"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-4">
                  {/* Word Input */}
                  <div>
                    <label className="block font-medium text-card-foreground mb-2">
                      Target Word *
                    </label>
                    <input
                      type="text"
                      value={newWord.word}
                      onChange={(e) => setNewWord(prev => ({ ...prev, word: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Enter the word to listen for"
                      required
                    />
                  </div>

                  {/* Color Picker */}
                  <div>
                    <label className="block font-medium text-card-foreground mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color) => (
                        <motion.button
                          key={color}
                          type="button"
                          onClick={() => setNewWord(prev => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newWord.color === color ? 'border-foreground' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Homophones */}
                  <div>
                    <label className="block font-medium text-card-foreground mb-2">
                      Homophones (Optional)
                    </label>
                    <div className="space-y-2">
                      {newWord.homophones.map((homophone, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={homophone}
                            onChange={(e) => updateHomophone(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Alternative pronunciation"
                          />
                          {newWord.homophones.length > 1 && (
                            <motion.button
                              type="button"
                              onClick={() => removeHomophone(index)}
                              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <X className="h-4 w-4" />
                            </motion.button>
                          )}
                        </div>
                      ))}
                    </div>
                    <motion.button
                      type="button"
                      onClick={addHomophoneField}
                      className="mt-2 text-sm text-primary hover:text-primary/80 transition-colors duration-200"
                      whileHover={{ scale: 1.05 }}
                    >
                      + Add another homophone
                    </motion.button>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center space-x-3 pt-4">
                    <motion.button
                      type="submit"
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors duration-200 flex items-center space-x-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Word</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 transition-colors duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {state.targetWords.length === 0 && (
            <motion.div
              className="text-center py-8 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p>No target words configured yet.</p>
              <p className="text-sm mt-1">Add some words to start tracking!</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;
