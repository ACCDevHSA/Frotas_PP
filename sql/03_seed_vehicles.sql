insert into public.vehicles(project,model,version,color,year_model,plate,renavam,chassis,rotation_day) values
('3TX 5P','New City Hatchback','Touring','Vermelho','24/25','TK07I95','1419014371','93HGN5890SK401244','Quarta-feira'),
('3TX 4P','New City Sedan','Touring','Cinza','24/25','TLS3C63','1419014169','93HGN2690SK201855','Terça-feira'),
('3UT','WR-V','EXL','Azul','25/26','UGC9J00','1461665792','93HRV3880TK210375','Quinta-feira'),
('3GN','New HR-V','Touring','Cinza','25/26','UEP6H77','1471609690','93HDG5840TK102401','Sexta-feira')
on conflict(plate) do update set project=excluded.project,model=excluded.model,version=excluded.version,color=excluded.color,year_model=excluded.year_model,renavam=excluded.renavam,chassis=excluded.chassis,rotation_day=excluded.rotation_day,updated_at=now();
