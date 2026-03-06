
import { useStore } from '../../context/StoreContext';
import { Heart } from 'lucide-react';
import RealityLab from '../../components/RealityLab';

const Desires = () => {
    const {
        addDesire,
        updateDesire,
        deleteDesire,
        addDesireSession
    } = useStore();

    return (
        <RealityLab
            title="Life Desires"
            description="Track, nurture, and manifest your biggest life goals using the Protocol."
            icon={Heart}
            stateKey="desires"
            actions={{
                add: addDesire,
                update: updateDesire,
                delete: deleteDesire,
                addSession: addDesireSession
            }}
            enableOracle={false}
            warheadContext="desires"
        />
    );
}

export default Desires;
