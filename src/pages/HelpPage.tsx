
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  Settings, 
  History, 
  Play, 
  Volume2, 
  TestTube2,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

const HelpPage: React.FC = () => {
  const [testResults, setTestResults] = useState<Array<{
    name: string;
    status: 'pass' | 'fail' | 'info';
    message: string;
  }>>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const runAutomatedTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    const tests = [
      {
        name: 'Speech Recognition Support',
        test: () => {
          const hasSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
          return {
            status: hasSupport ? 'pass' as const : 'fail' as const,
            message: hasSupport 
              ? 'Speech Recognition API is supported' 
              : 'Speech Recognition API is not supported in this browser'
          };
        }
      },
      {
        name: 'Microphone Access',
        test: async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return {
              status: 'pass' as const,
              message: 'Microphone access is available'
            };
          } catch (error) {
            return {
              status: 'fail' as const,
              message: 'Microphone access denied or unavailable'
            };
          }
        }
      },
      {
        name: 'Local Storage',
        test: () => {
          try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return {
              status: 'pass' as const,
              message: 'Local storage is working correctly'
            };
          } catch (error) {
            return {
              status: 'fail' as const,
              message: 'Local storage is not available'
            };
          }
        }
      },
      {
        name: 'Web Audio Context',
        test: () => {
          try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const context = new AudioContext();
            context.close();
            return {
              status: 'pass' as const,
              message: 'Web Audio API is supported'
            };
          } catch (error) {
            return {
              status: 'fail' as const,
              message: 'Web Audio API is not supported'
            };
          }
        }
      },
      {
        name: 'Browser Information',
        test: () => ({
          status: 'info' as const,
          message: `${navigator.userAgent.split(' ').slice(-2).join(' ')}`
        })
      }
    ];

    for (let i = 0; i < tests.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate test delay
      
      try {
        const result = await tests[i].test();
        setTestResults(prev => [...prev, {
          name: tests[i].name,
          ...result
        }]);
      } catch (error) {
        setTestResults(prev => [...prev, {
          name: tests[i].name,
          status: 'fail',
          message: `Test failed: ${error}`
        }]);
      }
    }

    setIsRunningTests(false);
  };

  const getResultIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'fail':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'info':
        return <Info className="h-5 w-5 text-primary" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Help & Support</h1>
        <p className="text-muted-foreground">
          Learn how to use Voice Tally and troubleshoot common issues
        </p>
      </motion.div>

      <div className="space-y-8">
        {/* Getting Started */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-semibold text-card-foreground mb-4 flex items-center space-x-2">
            <Play className="h-5 w-5 text-primary" />
            <span>Getting Started</span>
          </h2>
          
          <div className="space-y-4 text-muted-foreground">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</div>
              <div>
                <h3 className="font-medium text-card-foreground mb-1">Configure Target Words</h3>
                <p>Go to Settings and add the words you want to track. You can also add homophones (alternative pronunciations) for better detection.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</div>
              <div>
                <h3 className="font-medium text-card-foreground mb-1">Grant Microphone Permission</h3>
                <p>When prompted, allow the app to access your microphone. This is required for speech recognition to work.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">3</div>
              <div>
                <h3 className="font-medium text-card-foreground mb-1">Start Listening</h3>
                <p>Click "Start Listening" on the main page and begin speaking. The app will automatically detect and count your target words.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">4</div>
              <div>
                <h3 className="font-medium text-card-foreground mb-1">View History</h3>
                <p>Check the History page to see all detected words with timestamps and play back audio recordings.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Overview */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-card-foreground mb-4">Features Overview</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Mic className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-card-foreground">Real-time Speech Recognition</h3>
                  <p className="text-sm text-muted-foreground">Continuous listening with instant word detection</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Settings className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-card-foreground">Customizable Word Lists</h3>
                  <p className="text-sm text-muted-foreground">Add, remove, and configure target words with homophones</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <History className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-card-foreground">Detection History</h3>
                  <p className="text-sm text-muted-foreground">Complete log of all detections with audio playback</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Volume2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-card-foreground">Audio Feedback</h3>
                  <p className="text-sm text-muted-foreground">Optional sound notifications for word detections</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-card-foreground">Undo/Redo Support</h3>
                  <p className="text-sm text-muted-foreground">Easily revert changes to your tally counts</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Settings className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-card-foreground">Persistent Storage</h3>
                  <p className="text-sm text-muted-foreground">Your data is saved locally in your browser</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Troubleshooting */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold text-card-foreground mb-4">Troubleshooting</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-card-foreground mb-2">Speech recognition not working?</h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Make sure you're using Chrome, Edge, or Safari</li>
                <li>• Check that microphone permission is granted</li>
                <li>• Ensure your microphone is working in other applications</li>
                <li>• Try refreshing the page and granting permission again</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-card-foreground mb-2">Words not being detected?</h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Speak clearly and at a normal pace</li>
                <li>• Reduce background noise</li>
                <li>• Try adding homophones for alternative pronunciations</li>
                <li>• Adjust the confidence threshold in Settings</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-card-foreground mb-2">Audio playback not working?</h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Check that your browser supports audio recording</li>
                <li>• Ensure speakers/headphones are connected and working</li>
                <li>• Try enabling sound feedback in Settings</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* System Tests */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-card-foreground flex items-center space-x-2">
              <TestTube2 className="h-5 w-5 text-primary" />
              <span>System Diagnostics</span>
            </h2>
            
            <motion.button
              onClick={runAutomatedTests}
              disabled={isRunningTests}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              whileHover={{ scale: isRunningTests ? 1 : 1.05 }}
              whileTap={{ scale: isRunningTests ? 1 : 0.95 }}
            >
              {isRunningTests ? 'Running Tests...' : 'Run Tests'}
            </motion.button>
          </div>
          
          {testResults.length > 0 && (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <motion.div
                  key={result.name}
                  className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {getResultIcon(result.status)}
                  <div className="flex-1">
                    <h3 className="font-medium text-card-foreground">{result.name}</h3>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          
          {isRunningTests && (
            <motion.div
              className="flex items-center justify-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-primary rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
          
          {testResults.length === 0 && !isRunningTests && (
            <p className="text-muted-foreground text-center py-4">
              Click "Run Tests" to check your system compatibility
            </p>
          )}
        </motion.div>

        {/* Browser Support */}
        <motion.div
          className="bg-card border border-border rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xl font-semibold text-card-foreground mb-4">Browser Support</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-success mb-2">✅ Fully Supported</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Google Chrome 25+</li>
                <li>• Microsoft Edge 79+</li>
                <li>• Safari 14.1+</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-warning mb-2">⚠️ Limited Support</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Firefox (speech recognition disabled by default)</li>
                <li>• Mobile browsers (may have limitations)</li>
                <li>• Older browser versions</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> For the best experience, we recommend using Google Chrome or Microsoft Edge on desktop computers. Mobile support may vary depending on your device and operating system.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HelpPage;
