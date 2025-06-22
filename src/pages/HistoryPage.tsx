
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Calendar, Filter, Search } from 'lucide-react';
import { useTally } from '../context/TallyContext';
import HistoryItem from '../components/HistoryItem';
import { format, isToday, isYesterday, startOfDay, isSameDay } from 'date-fns';

const HistoryPage: React.FC = () => {
  const { state, dispatch } = useTally();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const filteredHistory = state.history.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.detectedWord.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = selectedDate === null || 
      isSameDay(new Date(item.timestamp), selectedDate);
    
    return matchesSearch && matchesDate;
  });

  const groupedHistory = filteredHistory.reduce((groups, item) => {
    const date = startOfDay(new Date(item.timestamp));
    const dateKey = date.toISOString();
    
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date,
        items: []
      };
    }
    
    groups[dateKey].items.push(item);
    return groups;
  }, {} as Record<string, { date: Date; items: typeof filteredHistory }>);

  const sortedGroups = Object.values(groupedHistory).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      dispatch({ type: 'CLEAR_HISTORY' });
    }
  };

  const uniqueDates = Array.from(
    new Set(state.history.map(item => startOfDay(new Date(item.timestamp)).toISOString()))
  ).map(dateStr => new Date(dateStr)).sort((a, b) => b.getTime() - a.getTime());

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Detection History</h1>
            <p className="text-muted-foreground">
              View and manage your word detection history
            </p>
          </div>
          
          {state.history.length > 0 && (
            <motion.button
              onClick={handleClearHistory}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 transition-colors duration-200 flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear History</span>
            </motion.button>
          )}
        </div>

        {/* Filters */}
        {state.history.length > 0 && (
          <motion.div
            className="bg-card border border-border rounded-xl p-4 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search words..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={selectedDate?.toISOString() || ''}
                  onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                  className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">All dates</option>
                  {uniqueDates.map((date) => (
                    <option key={date.toISOString()} value={date.toISOString()}>
                      {getDateLabel(date)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-6 pt-2 border-t border-border">
              <div className="text-sm">
                <span className="text-muted-foreground">Total detections: </span>
                <span className="font-semibold text-card-foreground">{state.history.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Showing: </span>
                <span className="font-semibold text-card-foreground">{filteredHistory.length}</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* History Groups */}
      <div className="space-y-8">
        <AnimatePresence>
          {sortedGroups.map(({ date, items }) => (
            <motion.div
              key={date.toISOString()}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">
                  {getDateLabel(date)}
                </h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm text-muted-foreground">
                  {items.length} detection{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="space-y-3">
                <AnimatePresence>
                  {items.map((item, index) => (
                    <HistoryItem key={item.id} item={item} index={index} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty States */}
      {state.history.length === 0 ? (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-card-foreground mb-2">
            No History Yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Start listening to see your word detections here
          </p>
          <motion.a
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Start Listening
          </motion.a>
        </motion.div>
      ) : filteredHistory.length === 0 ? (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Filter className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-card-foreground mb-2">
            No Results Found
          </h3>
          <p className="text-muted-foreground mb-4">
            No detections match your current filters
          </p>
          <motion.button
            onClick={() => {
              setSearchTerm('');
              setSelectedDate(null);
            }}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 transition-colors duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear Filters
          </motion.button>
        </motion.div>
      ) : null}
    </div>
  );
};

export default HistoryPage;
