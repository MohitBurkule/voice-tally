
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
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <motion.div
            className="flex items-center space-x-2 shrink-0"
            whileHover={{ scale: 1.05 }}
          >
            <Mic className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <span className="text-base sm:text-xl font-bold text-foreground">
              Voice Tally
            </span>
          </motion.div>

          {/* Icon-only on mobile, icon+label from sm up. Avoids navbar overflow
              on narrow phones where the four labels wouldn't fit. */}
          <div className="flex space-x-0.5 sm:space-x-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                aria-label={label}
                title={label}
                className={({ isActive }) =>
                  `flex items-center justify-center space-x-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`
                }
              >
                <Icon className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="font-medium hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
