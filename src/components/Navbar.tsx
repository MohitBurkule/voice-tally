
import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic, Settings, History, HelpCircle, Home } from 'lucide-react';

const Navbar: React.FC = () => {
  const navItems = [
    { to: '/', icon: Home, label: 'Tally' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/history', icon: History, label: 'History' },
    { to: '/help', icon: HelpCircle, label: 'Help' }
  ];

  return (
    <motion.nav 
      className="bg-white dark:bg-gray-800 shadow-lg sticky top-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <motion.div 
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
          >
            <Mic className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Voice Tally</span>
          </motion.div>
          
          <div className="flex space-x-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`
                }
              >
                {({ isActive }) => (
                  <motion.div
                    className="flex items-center space-x-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{label}</span>
                    {isActive && (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground"
                        layoutId="navbar-indicator"
                      />
                    )}
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
