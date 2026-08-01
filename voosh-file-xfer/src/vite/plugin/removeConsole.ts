import { Plugin } from 'vite';

export default function removeConsole(mode?: string): Plugin {
    return {
        name: 'remove-console',
        enforce: 'pre',
        transform(code, id) {
            if (id.includes('node_modules'))
                return null;
            if (!id.match(/\.(js|ts|jsx|tsx|mjs|cjs)$/))
                return null;
            if (mode !== 'production')
                return null;

            const cleaned = code.replace(/console\.(log|info|warn|debug)\([^;]*?\);?/g,
                match => {
                    if (match.includes('console.log(') && !match.includes('()')) {
                        return match;
                    }
                    const args = match.match(/console\.(log|info|warn|debug)\((.*?)\)/g);
                    if (args && args[2]) {
                        if (args[2].includes('()')) {
                            return args[2] + ';';
                        }
                    }
                    return '';
                }
            );

            return {
                code: cleaned,
                map: null
            };
        }
    }
};
