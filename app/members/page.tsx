import MemberList from '@/components/MemberList';

export default function MembersPage() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Members</h1>
          <p className="text-gray-700">Manage team members, assign to locations and teams</p>
        </div>
        <MemberList />
      </div>
    </div>
  );
}
