import { redirect } from 'next/navigation';

// Root redirects to splash; CTA leva ao dashboard/login conforme auth guard
export default function RootPage() {
  redirect('/splash');
}
