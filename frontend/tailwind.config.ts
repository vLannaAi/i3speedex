import type { Config } from 'tailwindcss'

export default <Config>{
    content: [
        './app.config.ts',
    ],
    theme: {
        extend: {
            colors: {
                colors: {
                    primary: {
                        50: '#fff0f3',
                        100: '#ffe3e8',
                        200: '#ffc9d4',
                        300: '#ff9fb3',
                        400: '#ff6486',
                        500: '#f52a55',
                        600: '#dd0939',
                        700: '#bb0231',
                        800: '#9b062d',
                        900: '#810a2a',
                        950: '#490213',
                        DEFAULT: '#bb0231',
                    }
                }
            }
        }
    }
}
