import { useStore } from '../context/StoreContext';
import { Atom } from 'lucide-react';
import RealityLab from './RealityLab';

const ManifestingLab = () => {
    const {
        addManifestation,
        updateManifestation,
        deleteManifestation,
        addManifestationSession
    } = useStore();

    return (
        <RealityLab
            title="The Manifesting Lab"
            description="Scientific experimentation with conscious creation. Test, record, analyze."
            icon={Atom}
            stateKey="manifestations"
            actions={{
                add: addManifestation,
                update: updateManifestation,
                delete: deleteManifestation,
                addSession: addManifestationSession
            }}
            enableOracle={true}
            warheadContext="experiments"
        />
    );
}

export default ManifestingLab;
