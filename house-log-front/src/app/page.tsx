import { redirect } from 'next/navigation';

// Root redirects to dashboard; auth guard in (app)/layout.tsx handles unauthenticated users
export default function RootPage() {
  redirect('/dashboard');
}
