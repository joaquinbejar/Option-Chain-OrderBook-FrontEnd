/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				primary: '#135bec',
				'background-light': '#f6f6f8',
				'background-dark': '#101622',
				'surface-dark': '#1a2230',
				'border-dark': '#232f48',
				'text-muted': '#92a4c9',
				success: '#0bda5e',
				danger: '#fa6238',
				warning: '#f59e0b'
			},
			fontFamily: {
				display: ['Manrope', 'sans-serif']
			},
			borderRadius: {
				DEFAULT: '0.25rem',
				lg: '0.5rem',
				xl: '0.75rem',
				full: '9999px'
			}
		}
	},
	plugins: []
};
