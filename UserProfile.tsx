import { useEffect, useState } from 'react';

export default function UserProfile(props: any) {
  const [user, setUser] = useState<any>({
    name: props.name || 'Max Mustermann',
    email: props.email || 'max@example.com',
    age: props.age || 25
  });
  const [name, setName] = useState(props.name || 'Max Mustermann');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (props.user) {
      setUser(props.user);
      setName(props.user.name);
    }
  }, []);

  function save() {
    if (user.email.indexOf('@') == -1) {
      alert('Bitte eine gültige E-Mail eingeben!');
      return;
    }

    user.name = name;
    if (props.onSave) props.onSave(user);
    setSaved(true);
  }

  return (
    <div style={{ padding: 17, background: '#eee', width: 400 }}>
      <h2>{user.name}</h2>
      <div>Name</div>
      <input
        value={name}
        onChange={e => {
          setName(e.target.value);
        }}
        style={{ padding: 7, margin: 5 }}
      />

      <div>E-Mail</div>
      <input
        defaultValue={user.email}
        onChange={e => {
          user.email = e.target.value;
        }}
        style={{ padding: 7, margin: 5 }}
      />

      <div>Alter: {user.age}</div>
      <div>{user.age >= 18 ? 'Volljährig' : 'Minderjährig'}</div>

      <div onClick={save} style={{ padding: 7, margin: 5, background: 'lightblue', cursor: 'pointer' }}>
        Speichern
      </div>
      {saved ? <span>Gespeichert!</span> : null}
    </div>
  );
}
