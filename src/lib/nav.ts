export const go = (path: string) => { location.hash = '/' + path }
export const back = () => { if (history.length > 1) history.back(); else go('') }
// Replace current history entry (used after creating a record so Back skips the picker).
export const replace = (path: string) => { location.replace('#/' + path) }
