import fs from 'fs';

const content = fs.readFileSync('src/pages/admin/EirJourneyAdmin.tsx', 'utf8');

const hotspotRegex = /\{\(itemFormData\.type === 'hotspot_image' \|\| itemFormData\.type === 'hotspot_link_image'\) && \([\s\S]*?\}\)\}\s*<\/div>\s*<\/div>\s*\)\}/;
const match = content.match(hotspotRegex);
if (!match) {
  console.log("Could not find hotspot block");
  process.exit(1);
}
let newContent = content.replace(hotspotRegex, '');

const quizEndRegex = /\{\s*itemFormData\.type === 'quiz' && \([\s\S]*?\)\s*\}\s*<\/div>\s*<div className=\{`px-6 py-4 border-t/;
const quizMatch = newContent.match(quizEndRegex);

if (!quizMatch) {
  console.log("Could not find quiz end block");
  process.exit(1);
}

// Ensure the hotspots block is unwrapped from its conditional since we wrap it again
const innerHotspot = match[0].replace(/\{\(itemFormData\.type === 'hotspot_image' \|\| itemFormData\.type === 'hotspot_link_image'\) && \(/, '').replace(/\)\}/, '');

let modifiedQuizMatch = quizMatch[0].replace(
  /<\/div>\s*<div className=\{`px-6 py-4 border-t/,
`
              </div>

              {isHotspotType && (
                <div className="overflow-y-auto h-[75vh] space-y-5 pl-6 border-l border-slate-200 dark:border-slate-800 pb-10">
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2 border-b dark:border-slate-800">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Pontos Interativos</p>
                    <button 
                      type="button"
                      onClick={() => {
                        const newHotspot = { id: Date.now().toString(), x: 50, y: 50, title: 'Novo Pop-up', content: '' };
                        setItemFormData({...itemFormData, hotspots: [...(itemFormData.hotspots || []), newHotspot]});
                      }}
                      className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg font-bold flex items-center gap-1 shadow-sm hover:bg-indigo-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Ponto Manualmente
                    </button>
                  </div>
                  ` + innerHotspot.replace(/<div className="flex items-center justify-between mb-3">[\s\S]*?<Plus className="w-3 h-3" \/> Adicionar Manualmente[\s\S]*?<\/button>[\s\S]*?<\/div>/, '') + `
              )}
            </div>
            <div className={\`shrink-0 px-6 py-4 border-t`
);

newContent = newContent.replace(quizMatch[0], modifiedQuizMatch);
fs.writeFileSync('src/pages/admin/EirJourneyAdmin.tsx', newContent, 'utf8');
console.log("Updated EirJourneyAdmin.tsx");
