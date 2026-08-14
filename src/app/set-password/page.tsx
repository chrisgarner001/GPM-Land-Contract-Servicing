import SetPasswordForm from "./_components/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Set Your Password</h1>
      <p className="mb-6 text-sm text-slate-500">Choose a password to finish setting up your account.</p>
      <SetPasswordForm />
    </main>
  );
}
