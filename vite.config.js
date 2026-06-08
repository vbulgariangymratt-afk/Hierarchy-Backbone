import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    plugins: [
      react(),

      {
      name: 'local-persistence-handler',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/save-local' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const baseDir = path.resolve(__dirname, 'local_data');

                const write = (subDir, fileName, content) => {
                  const dir = path.join(baseDir, subDir);
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(content, null, 2));
                };

                // Split and write data to organized folders
                write('habits', 'habits.json', data.habits || {});

                write('activities', 'skills.json', data.skills || {});
                write('activities', 'tasks.json', data.tasks || {});
                write('activities', 'objectives.json', data.objectives || {});
                write('activities', 'timeblocks.json', data.timeBlocks || {});
                write('activities', 'flashcards.json', data.flashcardFolders || {});

                write('areas', 'areas.json', data.areas || {});
                write('areas', 'order.json', data.areaOrder || []);

                write('beliefs', 'beliefs.json', data.beliefs || {});
                write('beliefs', 'topics.json', data.beliefTopics || {});
                write('beliefs', 'manifestations.json', data.manifestations || {});
                write('beliefs', 'desires.json', data.desires || {});

                write('community', 'journal.json', data.journal || {});
                write('community', 'chat.json', data.chatSessions || {});

                write('gamification', 'rewards.json', data.rewards || {});

                write('finance', 'wealth.json', data.wealthItems || {});

                write('meds', 'available.json', data.availableMeds || []);

                write('trackers', 'config.json', data.trackers || {});

                const coreSettings = {
                  userProfile: data.userProfile,
                  themeMode: data.themeMode,
                  currency: data.currency,
                  apiKey: data.apiKey,
                  showBackgrounds: data.showBackgrounds,
                  backgrounds: data.backgrounds,
                  routineTemplates: data.routineTemplates,
                  logs: data.logs
                };
                write('core', 'settings.json', coreSettings);

                console.log('📝 Data saved to organized local_data/ folders');
                res.statusCode = 200;
                res.end('OK');
              } catch (e) {
                console.error('Error saving local data:', e);
                res.statusCode = 500;
                res.end('Error saving to disk');
              }
            });
          } else if (req.url === '/api/backbone-v2/save' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const filePath = path.resolve(__dirname, 'v2_data.json');
                fs.writeFileSync(filePath, body);
                console.log('💾 Backbone V2 data saved to v2_data.json');
                res.statusCode = 200;
                res.end('OK');
              } catch (e) {
                console.error('Error saving V2 data:', e);
                res.statusCode = 500;
                res.end('Error saving V2 data');
              }
            });
          } else if (req.url === '/api/backbone-v2/load' && req.method === 'GET') {
            try {
              const filePath = path.resolve(__dirname, 'v2_data.json');
              if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
              } else {
                res.end('[]');
              }
            } catch (e) {
              console.error('Error loading V2 data:', e);
              res.statusCode = 500;
              res.end('[]');
            }
          } else if (req.url === '/api/habit-data/save' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const filePath = path.resolve(__dirname, 'habit_data.json');
                fs.writeFileSync(filePath, body);
                console.log('💾 Habit Data saved to habit_data.json');
                res.statusCode = 200;
                res.end('OK');
              } catch (e) {
                console.error('Error saving Habit data:', e);
                res.statusCode = 500;
                res.end('Error saving Habit data');
              }
            });
          } else if (req.url === '/api/habit-data/load' && req.method === 'GET') {
            try {
              const filePath = path.resolve(__dirname, 'habit_data.json');
              if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
              } else {
                res.end('[]');
              }
            } catch (e) {
              console.error('Error loading Habit data:', e);
              res.statusCode = 500;
              res.end('[]');
            }
          } else if (req.url === '/api/journal-data/save' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const filePath = path.resolve(__dirname, 'journal_data.json');
                fs.writeFileSync(filePath, body);
                console.log('💾 Journal Data saved to journal_data.json');
                res.statusCode = 200;
                res.end('OK');
              } catch (e) {
                console.error('Error saving Journal data:', e);
                res.statusCode = 500;
                res.end('Error saving Journal data');
              }
            });
          } else if (req.url === '/api/journal-data/load' && req.method === 'GET') {
            try {
              const filePath = path.resolve(__dirname, 'journal_data.json');
              if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
              } else {
                res.end('[]');
              }
            } catch (e) {
              console.error('Error loading Journal data:', e);
              res.statusCode = 500;
              res.end('[]');
            }
          } else if (req.url && req.url.startsWith('/auth/callback') && !req.url.includes('mode=web')) {
            // Store the full callback URL so the Tauri app can poll for it
            server._pendingOAuthCallback = req.url;
            // Return a page that closes itself
            res.setHeader('Content-Type', 'text/html');
            res.statusCode = 200;
            res.end(`
              <html>
                <body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                  <div style="text-align:center;">
                    <h2>✅ Logged in!</h2>
                    <p>You can close this tab and return to the app.</p>
                    <script>window.close();</script>
                  </div>
                </body>
              </html>
            `);
          } else if (req.url === '/api/auth/poll-callback' && req.method === 'GET') {
            // The Tauri app polls this endpoint to get the pending callback URL
            if (server._pendingOAuthCallback) {
              const pending = server._pendingOAuthCallback;
              server._pendingOAuthCallback = null; // Clear it after reading
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ url: pending }));
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ url: null }));
            }
          } else {
            next();
          }

        });
      }
    },
    ].filter(Boolean),
    server: {
      historyApiFallback: true, // Allows /auth/callback to load the React app
      watch: {
        ignored: ['**/v2_data.json', '**/habit_data.json', '**/journal_data.json', '**/local_data/**']
      }
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info', 'console.warn'],
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['framer-motion', 'lucide-react'],
            'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/modifiers', '@dnd-kit/utilities'],
          }
        }
      }
    }
  }
})
