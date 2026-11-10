export const PASSWORD_RULES = [
  { id: 'length', label: 'No mínimo 10 caracteres', test: (p: string) => p.length >= 10 },
  { id: 'lower', label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Um número', test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'Um caractere especial (ex: ! @ # $ %)', test: (p: string) => /[^A-Za-z\d]/.test(p) },
]

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every(rule => rule.test(password))
}

export function missingPasswordRules(password: string): string[] {
  return PASSWORD_RULES.filter(rule => !rule.test(password)).map(rule => rule.label.toLowerCase())
}
