export const PROFESSIONALS = [
  {
    id: 'luis',
    name: 'Luis Israel Valeriano Rodríguez',
    signaturePath: '/firma1.png',
    registry: '01534'
  },
  {
    id: 'omadis',
    name: 'Omadis Emelda Meza González',
    signaturePath: '/firma2.png',
    registry: 'CC. 1047510854'
  }
];

export const getProfessionalById = (id: string) => {
  return PROFESSIONALS.find(p => p.id === id) || PROFESSIONALS[0]; // Default to Luis Valeriano
};

export const getProfessionalByName = (name: string) => {
  return PROFESSIONALS.find(p => p.name === name) || PROFESSIONALS[0];
};
