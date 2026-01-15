import MemberList from '../components/MemberList';
import TeamList from '../components/TeamList';
import LocationList from '../components/LocationList';

export default function OrganizationPage() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Organization</h1>
          <p className="text-gray-700">Manage your locations, teams, and members</p>
        </div>
        
        <div className="space-y-12">
          <section>
            <LocationList />
          </section>
          
          <section>
            <TeamList />
          </section>
          
          <section>
            <MemberList />
          </section>
        </div>
      </div>
    </div>
  );
}
